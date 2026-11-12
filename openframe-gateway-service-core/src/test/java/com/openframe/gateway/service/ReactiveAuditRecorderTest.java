package com.openframe.gateway.service;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.openframe.data.document.apikey.ApiKey;
import com.openframe.data.document.audit.AuditAction;
import com.openframe.data.document.audit.AuditOutcome;
import com.openframe.data.model.audit.AuditActor;
import com.openframe.data.model.audit.AuditEntry;
import com.openframe.data.model.audit.AuditRequestInfo;
import com.openframe.data.reactive.repository.apikey.ReactiveApiKeyRepository;
import com.openframe.data.reactive.service.AuditCaller;
import com.openframe.data.reactive.service.ReactiveAuditEventWriter;
import com.openframe.data.service.AuditTenantResolver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.Mock;
import org.mockito.invocation.InvocationOnMock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.ReactiveSecurityContextHolder;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextImpl;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.List;

import static com.openframe.data.document.audit.AuditActorType.API_KEY;
import static com.openframe.data.document.audit.AuditActorType.DEVICE;
import static com.openframe.data.document.audit.AuditActorType.STAFF;
import static com.openframe.data.document.audit.AuditActorType.SYSTEM;
import static com.openframe.data.document.audit.AuditActorType.USER;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReactiveAuditRecorderTest {

    private static final String SUPER_TENANT_ID = "super-tenant";
    private static final String ACTOR_TENANT_ID = "actor-tenant";
    private static final String ROUTED_TENANT_ID = "routed-tenant";
    private static final String USER_ID = "user-1";
    private static final String EMAIL = "anna@acme.com";
    private static final String MACHINE_ID = "machine-1";
    private static final String KEY_ID = "key-1";
    private static final String CLIENT_IP = "203.0.113.24";
    private static final String ONCE_KEY = "rejected-token";
    private static final AuditEntry ENTRY = entry(AuditAction.TICKET_ARCHIVE);
    private static final AuditActor SYSTEM_ACTOR = new AuditActor(SYSTEM, null, null, null, List.of(), null, null, null);
    private static final AuditActor USER_ACTOR =
            new AuditActor(USER, USER_ID, null, EMAIL, List.of("ADMIN"), ACTOR_TENANT_ID, null, null);
    private static final AuditActor KEY_WITHOUT_RECORD =
            new AuditActor(API_KEY, KEY_ID, null, null, List.of(), null, USER_ID, null);
    private static final AuditRequestInfo REQUEST_SOURCE = new AuditRequestInfo(CLIENT_IP, "Chrome", "request-1", null);
    private static final AuditCaller REQUEST_CALLER = new AuditCaller(SYSTEM_ACTOR, REQUEST_SOURCE, ROUTED_TENANT_ID);

    @Mock private ReactiveApiKeyRepository apiKeyRepository;
    @Mock private AuditTenantResolver tenantResolver;
    @Mock private ReactiveAuditEventWriter writer;

    private ReactiveAuditRecorder recorder;
    private AuditCaller writtenCaller;

    @BeforeEach
    void setUp() {
        recorder = new ReactiveAuditRecorder(apiKeyRepository, tenantResolver, writer);
    }

    @Test
    void callerOf_userToken_findsTheUserAndTheirSignIn() {
        when(tenantResolver.superTenantId()).thenReturn(SUPER_TENANT_ID);

        AuditCaller caller = callerOf(request(), userToken(ACTOR_TENANT_ID));

        assertThat(caller)
                .extracting(AuditCaller::actor, AuditCaller::requestInfo)
                .containsExactly(USER_ACTOR, REQUEST_SOURCE.withSessionId("session-1"));
    }

    @Test
    void callerOf_tokenAndApiKeyHeaders_takesTheToken() {
        when(tenantResolver.superTenantId()).thenReturn(SUPER_TENANT_ID);

        AuditCaller caller = callerOf(apiKeyRequest(), userToken(ACTOR_TENANT_ID));

        assertThat(caller.actor()).isEqualTo(USER_ACTOR);
    }

    @Test
    void callerOf_routedTenantHeader_servesTheRoutedTenant() {
        AuditCaller caller = recorder.callerOf(request()).block();

        assertThat(caller.servedTenantId()).isEqualTo(ROUTED_TENANT_ID);
    }

    @Test
    void callerOf_superTenantToken_findsStaff() {
        when(tenantResolver.superTenantId()).thenReturn(SUPER_TENANT_ID);

        AuditCaller caller = callerOf(request(), userToken(SUPER_TENANT_ID));

        assertThat(caller.actor())
                .isEqualTo(new AuditActor(STAFF, USER_ID, null, EMAIL, List.of("ADMIN"), SUPER_TENANT_ID, null, null));
    }

    @Test
    void callerOf_agentToken_findsTheDevice() {
        AuditCaller caller = callerOf(request(), agentToken());

        assertThat(caller.actor())
                .isEqualTo(new AuditActor(DEVICE, MACHINE_ID, null, null, List.of("AGENT"), ACTOR_TENANT_ID, null, null));
    }

    @Test
    void callerOf_apiKeyHeaders_findsTheKeyActingForItsOwner() {
        ApiKey key = ApiKey.builder().keyId(KEY_ID).name("Billing sync").roles(List.of("ADMIN"))
                .tenantId(ACTOR_TENANT_ID).build();
        when(apiKeyRepository.findById(KEY_ID)).thenReturn(Mono.just(key));

        AuditCaller caller = recorder.callerOf(apiKeyRequest()).block();

        assertThat(caller.actor()).isEqualTo(
                new AuditActor(API_KEY, KEY_ID, "Billing sync", null, List.of("ADMIN"), ACTOR_TENANT_ID, USER_ID, null));
    }

    @Test
    void callerOf_apiKeyRecordGone_findsTheKeyWithoutItsRecord() {
        when(apiKeyRepository.findById(KEY_ID)).thenReturn(Mono.empty());

        AuditCaller caller = recorder.callerOf(apiKeyRequest()).block();

        assertThat(caller.actor()).isEqualTo(KEY_WITHOUT_RECORD);
    }

    @Test
    void callerOf_apiKeyLookupFails_logsItAndFindsTheKeyWithoutItsRecord() {
        when(apiKeyRepository.findById(KEY_ID))
                .thenReturn(Mono.error(new DataAccessResourceFailureException("mongo down")));
        Logger logger = (Logger) LoggerFactory.getLogger(ReactiveAuditRecorder.class);
        ListAppender<ILoggingEvent> log = new ListAppender<>();
        log.start();
        logger.addAppender(log);

        AuditCaller caller = recorder.callerOf(apiKeyRequest()).block();

        logger.detachAppender(log);
        assertThat(caller.actor()).isEqualTo(KEY_WITHOUT_RECORD);
        assertThat(log.list)
                .extracting(ILoggingEvent::getLevel, ILoggingEvent::getFormattedMessage,
                        event -> event.getThrowableProxy().getClassName())
                .containsExactly(tuple(Level.ERROR, "Audit lookup failed, the event is stored without its result",
                        DataAccessResourceFailureException.class.getName()));
    }

    @Test
    void callerOf_noTokenAndNoApiKey_findsTheSystem() {
        AuditCaller caller = recorder.callerOf(request()).block();

        assertThat(caller.actor()).isEqualTo(SYSTEM_ACTOR);
    }

    @Test
    void callerOf_noRoutedTenantHeader_servesTheGatewaysOwnTenant() {
        when(tenantResolver.servedTenantId()).thenReturn("served-tenant");

        AuditCaller caller = recorder.callerOf(MockServerHttpRequest.get("/tools/fleet").build()).block();

        assertThat(caller.servedTenantId()).isEqualTo("served-tenant");
    }

    @ParameterizedTest
    @MethodSource("contextsWithoutJwt")
    void callerOf_securityContextWithoutJwt_findsTheSystem(SecurityContext context) {
        AuditCaller caller = recorder.callerOf(request())
                .contextWrite(ReactiveSecurityContextHolder.withSecurityContext(Mono.just(context)))
                .block();

        assertThat(caller.actor()).isEqualTo(SYSTEM_ACTOR);
    }

    @Test
    void record_entryAndRequest_writesTheEntryAsTheRequestsCaller() {
        writeAllKeepsTheCaller(List.of(ENTRY));

        recorder.record(ENTRY, request()).block();

        assertThat(writtenCaller).isEqualTo(REQUEST_CALLER);
    }

    @Test
    void recordAll_entriesAndRequest_writesThemAsTheRequestsCaller() {
        List<AuditEntry> entries = List.of(ENTRY, entry(AuditAction.STAFF_TENANT_ACCESS_START));
        writeAllKeepsTheCaller(entries);

        recorder.recordAll(entries, request()).block();

        assertThat(writtenCaller).isEqualTo(REQUEST_CALLER);
    }

    @Test
    void record_entryRequestAndActor_writesTheEntryAsThatActor() {
        writeAllKeepsTheCaller(List.of(ENTRY));

        recorder.record(ENTRY, request(), USER_ACTOR).block();

        assertThat(writtenCaller).isEqualTo(new AuditCaller(USER_ACTOR, REQUEST_SOURCE, ROUTED_TENANT_ID));
    }

    @Test
    void record_entryAndCaller_writesTheEntryAsThatCaller() {
        AuditCaller kept = new AuditCaller(USER_ACTOR, REQUEST_SOURCE.withSessionId("session-1"), ROUTED_TENANT_ID);
        writeAllKeepsTheCaller(List.of(ENTRY));

        recorder.record(ENTRY, kept).block();

        assertThat(writtenCaller).isSameAs(kept);
    }

    @Test
    void recordOnce_entryRequestAndKey_writesOncePerMinuteAsTheRequestsCaller() {
        writeOnceKeepsTheCaller(Duration.ofMinutes(1));

        recorder.recordOnce(ENTRY, request(), ONCE_KEY).block();

        assertThat(writtenCaller).isEqualTo(REQUEST_CALLER);
    }

    @Test
    void recordOnce_window_writesOncePerThatWindow() {
        writeOnceKeepsTheCaller(Duration.ofDays(7));

        recorder.recordOnce(ENTRY, request(), ONCE_KEY, Duration.ofDays(7)).block();

        assertThat(writtenCaller).isEqualTo(REQUEST_CALLER);
    }

    @Test
    void recordOnce_entryRequestActorAndKey_writesOncePerMinuteAsThatActor() {
        writeOnceKeepsTheCaller(Duration.ofMinutes(1));

        recorder.recordOnce(ENTRY, request(), USER_ACTOR, ONCE_KEY).block();

        assertThat(writtenCaller).isEqualTo(new AuditCaller(USER_ACTOR, REQUEST_SOURCE, ROUTED_TENANT_ID));
    }

    private AuditCaller callerOf(ServerHttpRequest request, Jwt token) {
        return recorder.callerOf(request)
                .contextWrite(ReactiveSecurityContextHolder.withAuthentication(new JwtAuthenticationToken(token)))
                .block();
    }

    private void writeAllKeepsTheCaller(List<AuditEntry> entries) {
        when(writer.writeAll(eq(entries), any())).thenAnswer(this::keepCaller);
    }

    private void writeOnceKeepsTheCaller(Duration window) {
        when(writer.writeOnce(eq(ENTRY), any(), eq(ONCE_KEY), eq(window))).thenAnswer(this::keepCaller);
    }

    private Mono<Void> keepCaller(InvocationOnMock call) {
        Mono<AuditCaller> caller = call.getArgument(1);
        return caller.doOnNext(found -> writtenCaller = found).then();
    }

    private static List<SecurityContext> contextsWithoutJwt() {
        return List.of(new SecurityContextImpl(), new SecurityContextImpl(new AnonymousAuthenticationToken("key",
                "anonymousUser", AuthorityUtils.createAuthorityList("ROLE_ANONYMOUS"))));
    }

    private static ServerHttpRequest request() {
        return MockServerHttpRequest.get("/tools/fleet")
                .header("X-Client-Ip", CLIENT_IP)
                .header("User-Agent", "Chrome")
                .header("X-Request-Id", "request-1")
                .header("X-Tenant-Id", ROUTED_TENANT_ID)
                .build();
    }

    private static ServerHttpRequest apiKeyRequest() {
        return MockServerHttpRequest.get("/external-api/tickets")
                .header("X-API-Key-Id", KEY_ID)
                .header("X-User-Id", USER_ID)
                .header("X-Tenant-Id", ROUTED_TENANT_ID)
                .build();
    }

    private static AuditEntry entry(AuditAction action) {
        return AuditEntry.builder().action(action).outcome(AuditOutcome.SUCCESS).build();
    }

    private static Jwt userToken(String tenantId) {
        return Jwt.withTokenValue("token")
                .header("alg", "none")
                .subject(EMAIL)
                .claim("userId", USER_ID)
                .claim("roles", List.of("ADMIN"))
                .claim("tenant_id", tenantId)
                .claim("sid", "session-1")
                .build();
    }

    private static Jwt agentToken() {
        return Jwt.withTokenValue("token")
                .header("alg", "none")
                .subject("agent-client-1")
                .claim("roles", List.of("AGENT"))
                .claim("tenant_id", ACTOR_TENANT_ID)
                .claim("machine_id", MACHINE_ID)
                .build();
    }
}
