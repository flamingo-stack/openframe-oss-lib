package com.openframe.authz.service.sso;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.openframe.authz.dto.RegistrationAttribution;
import com.openframe.authz.service.sso.SignupTicketService.PendingSignup;
import com.openframe.data.redis.OpenframeRedisKeyBuilder;
import com.openframe.data.redis.OpenframeRedisProperties;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;

import static com.openframe.authz.support.SsoTestFixtures.objectMapper;
import static org.assertj.core.api.Assertions.as;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.InstanceOfAssertFactories.STRING;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SignupTicketServiceTest {

    @Mock
    private RedisTemplate<String, String> redisTemplate;
    @Mock
    private ValueOperations<String, String> values;

    private final Logger logger = (Logger) LoggerFactory.getLogger(SignupTicketService.class);

    private SignupTicketService service;

    @BeforeEach
    void setUp() {
        OpenframeRedisProperties props = new OpenframeRedisProperties();
        props.setTenantId("t1");
        service = new SignupTicketService(redisTemplate, new OpenframeRedisKeyBuilder(props), objectMapper());
        when(redisTemplate.opsForValue()).thenReturn(values);
    }

    @AfterEach
    void resetLogger() {
        logger.detachAndStopAllAppenders();
        logger.setLevel(null);
    }

    @Test
    void shouldIssueOpaqueTicketStoredForTenMinutes() {
        String ticket = service.create("a@acme.com", "A", "B", "google", true, "g-1", null);

        ArgumentCaptor<String> json = ArgumentCaptor.forClass(String.class);
        verify(values).set(eq(keyFor(ticket)), json.capture(), eq(Duration.ofMinutes(10)));
        assertThat(ticket).matches("^[A-Za-z0-9_-]{43}$");
        assertThat(json.getValue()).contains("\"email\":\"a@acme.com\"").contains("\"subject\":\"g-1\"");
    }

    @Test
    void create_calledTwice_issuesDifferentTickets() {
        String first = service.create("a@acme.com", "A", "B", "google", true, "g-1", null);
        String second = service.create("a@acme.com", "A", "B", "google", true, "g-1", null);

        assertThat(first).isNotEqualTo(second);
    }

    @Test
    void create_withAttribution_storesItInThePayload() {
        String ticket = service.create("a@acme.com", "A", "B", "google", true, "g-1", attribution());

        assertThat(readBack(ticket, Duration.ofMinutes(10)).attribution()).isEqualTo(attribution());
    }

    @Test
    void create_newSignup_storesNameAndProviderUnbound() {
        String ticket = service.create("a@acme.com", "Ann", "Bell", "microsoft", false, "ms-1", null);

        assertThat(readBack(ticket, Duration.ofMinutes(10)))
                .returns("Ann", PendingSignup::firstName)
                .returns("Bell", PendingSignup::lastName)
                .returns("microsoft", PendingSignup::provider)
                .returns(false, PendingSignup::emailVerified)
                .returns(null, PendingSignup::userId)
                .returns(null, PendingSignup::tenantId);
    }

    @Test
    void create_redisDown_throwsWriteFailed() {
        doThrow(new RedisConnectionFailureException("redis down")).when(values)
                .set(anyString(), anyString(), any(Duration.class));

        assertThatThrownBy(() -> service.create("a@acme.com", "A", "B", "google", true, "g-1", null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("signup_ticket_write_failed")
                .hasCauseInstanceOf(RedisConnectionFailureException.class);
    }

    @Test
    void peek_payloadWrittenBeforeAttribution_returnsPayloadWithoutAttribution() {
        when(values.get(anyString())).thenReturn("{\"email\":\"a@acme.com\",\"firstName\":\"A\",\"lastName\":\"B\","
                + "\"provider\":\"google\",\"emailVerified\":true,\"subject\":\"g-1\",\"userId\":\"user-1\",\"tenantId\":\"tenant-1\"}");

        assertThat(service.peek("t")).hasValue(new PendingSignup("a@acme.com", "A", "B", "google", true, "g-1",
                "user-1", "tenant-1", null));
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(longs = 0)
    void bind_noPositiveRemainingTtl_storesForTenMinutes(Long remaining) {
        when(values.get(anyString())).thenReturn("{\"email\":\"a@acme.com\",\"provider\":\"google\",\"emailVerified\":true}");
        when(redisTemplate.getExpire(anyString())).thenReturn(remaining);

        service.bind("t", "user-1", "tenant-1");

        verify(values).set(anyString(), anyString(), eq(Duration.ofMinutes(10)));
    }

    @Test
    void bind_ticketWithAttribution_keepsIt() {
        when(values.get(anyString())).thenReturn("{\"email\":\"a@acme.com\",\"provider\":\"google\",\"emailVerified\":true,"
                + "\"attribution\":{\"utmSource\":\"newsletter\",\"gclid\":\"gclid-1\"}}");
        when(redisTemplate.getExpire(anyString())).thenReturn(120L);

        service.bind("t", "user-1", "tenant-1");

        assertThat(readBack("t", Duration.ofSeconds(120)).attribution()).isEqualTo(attribution());
    }

    @Test
    void bind_unboundTicket_keepsIdentity() {
        when(values.get(keyFor("t"))).thenReturn("{\"email\":\"a@acme.com\",\"firstName\":\"Ann\",\"lastName\":\"Bell\","
                + "\"provider\":\"microsoft\",\"emailVerified\":true,\"subject\":\"ms-1\"}");
        when(redisTemplate.getExpire(keyFor("t"))).thenReturn(120L);

        service.bind("t", "user-1", "tenant-1");

        assertThat(readBack("t", Duration.ofSeconds(120)))
                .returns("a@acme.com", PendingSignup::email)
                .returns("Ann", PendingSignup::firstName)
                .returns("Bell", PendingSignup::lastName)
                .returns("microsoft", PendingSignup::provider)
                .returns(true, PendingSignup::emailVerified)
                .returns("ms-1", PendingSignup::subject);
    }

    @Test
    void shouldPeekWithoutConsumingAndConsumeOnce() {
        String json = "{\"email\":\"a@acme.com\",\"provider\":\"google\",\"emailVerified\":true}";
        when(values.get(anyString())).thenReturn(json);
        when(values.getAndDelete(anyString())).thenReturn(json, (String) null);

        assertThat(service.peek("t")).hasValueSatisfying(p -> assertThat(p.bound()).isFalse());
        assertThat(service.consume("t")).isPresent();
        assertThat(service.consume("t")).isEmpty();
    }

    @Test
    void shouldBindUserAndTenantKeepingRemainingTtl() {
        when(values.get(anyString())).thenReturn("{\"email\":\"a@acme.com\",\"provider\":\"google\",\"emailVerified\":true}");
        when(redisTemplate.getExpire(anyString())).thenReturn(120L);

        service.bind("t", "user-1", "tenant-1");

        ArgumentCaptor<String> json = ArgumentCaptor.forClass(String.class);
        verify(values).set(anyString(), json.capture(), eq(Duration.ofSeconds(120)));
        assertThat(json.getValue()).contains("\"userId\":\"user-1\"").contains("\"tenantId\":\"tenant-1\"");
    }

    @Test
    void shouldRefuseToBindExpiredTicket() {
        when(values.get(anyString())).thenReturn(null);

        assertThatThrownBy(() -> service.bind("t", "u", "t")).hasMessageContaining("Signup session expired");
    }

    @Test
    void shouldTreatUndecodablePayloadAsMissing() {
        ListAppender<ILoggingEvent> logs = captureWarnings();
        when(values.get(anyString())).thenReturn("{broken");

        assertThat(service.peek("t")).isEmpty();
        assertThat(logs.list).singleElement()
                .returns(Level.WARN, ILoggingEvent::getLevel)
                .extracting(ILoggingEvent::getFormattedMessage, as(STRING))
                .startsWith("Undecodable pending signup: ");
    }

    private PendingSignup readBack(String ticket, Duration ttl) {
        ArgumentCaptor<String> json = ArgumentCaptor.forClass(String.class);
        verify(values).set(eq(keyFor(ticket)), json.capture(), eq(ttl));
        when(values.get(keyFor(ticket))).thenReturn(json.getValue());
        return service.peek(ticket).orElseThrow();
    }

    private ListAppender<ILoggingEvent> captureWarnings() {
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);
        logger.setLevel(Level.WARN);
        return appender;
    }

    private static RegistrationAttribution attribution() {
        return RegistrationAttribution.builder().utmSource("newsletter").gclid("gclid-1").build();
    }

    private static String keyFor(String ticket) {
        OpenframeRedisProperties props = new OpenframeRedisProperties();
        props.setTenantId("t1");
        return new OpenframeRedisKeyBuilder(props).tenantKey("sso:signup-ticket:" + ticket);
    }
}
