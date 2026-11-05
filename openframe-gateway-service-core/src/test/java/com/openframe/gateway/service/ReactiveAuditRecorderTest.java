package com.openframe.gateway.service;

import com.openframe.data.document.apikey.ApiKey;
import com.openframe.data.document.audit.AuditAction;
import com.openframe.data.document.audit.AuditActorType;
import com.openframe.data.document.audit.AuditEntry;
import com.openframe.data.document.audit.AuditEvent;
import com.openframe.data.document.audit.AuditOutcome;
import com.openframe.data.document.audit.AuditRequestContext;
import com.openframe.data.document.audit.AuditTargetType;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.user.User;
import com.openframe.data.mapper.AuditEventMapperImpl;
import com.openframe.data.reactive.repository.apikey.ReactiveApiKeyRepository;
import com.openframe.data.reactive.repository.audit.ReactiveAuditEventRepository;
import com.openframe.data.reactive.repository.device.ReactiveMachineRepository;
import com.openframe.data.reactive.repository.user.ReactiveUserRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.gateway.tenant.TenantRoutingHeaders;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.security.core.context.ReactiveSecurityContextHolder;
import org.springframework.security.core.context.SecurityContextImpl;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;
import tools.jackson.databind.ObjectMapper;

import java.util.List;

import static com.openframe.core.constants.HttpHeaders.X_API_KEY_ID;
import static com.openframe.core.constants.HttpHeaders.X_USER_ID;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReactiveAuditRecorderTest {

    private static final String SUPER_TENANT_ID = "super-tenant";
    private static final String ROUTED_TENANT_ID = "tenant-1";
    private static final String USER_ID = "user-1";
    private static final String MACHINE_ID = "machine-1";

    @Mock private ReactiveAuditEventRepository auditEventRepository;
    @Mock private ReactiveUserRepository userRepository;
    @Mock private ReactiveMachineRepository machineRepository;
    @Mock private ReactiveApiKeyRepository apiKeyRepository;
    @Mock private TenantIdProvider tenantIdProvider;
    @Captor private ArgumentCaptor<AuditEvent> eventCaptor;

    private ReactiveAuditRecorder recorder;

    @BeforeEach
    void setUp() {
        recorder = new ReactiveAuditRecorder(auditEventRepository, userRepository, machineRepository,
                apiKeyRepository, tenantIdProvider, new AuditEventMapperImpl(), new ObjectMapper(), SUPER_TENANT_ID);
    }

    @Test
    void recordsTechnicianActionWithTokenAndHeaders() {
        insertSucceeds();
        when(userRepository.findById(USER_ID)).thenReturn(Mono.just(user("Anna", "Kowalski")));
        ServerWebExchange exchange = MockServerWebExchange.from(MockServerHttpRequest.post("/api/tickets")
                .header(AuditRequestContext.CLIENT_IP_HEADER, "203.0.113.24")
                .header("User-Agent", "Chrome")
                .header(AuditRequestContext.REQUEST_ID_HEADER, "request-1")
                .header(TenantRoutingHeaders.TENANT_ID_HEADER, ROUTED_TENANT_ID));
        Jwt jwt = jwt(USER_ID, "anna@acme.com", List.of("ADMIN"), ROUTED_TENANT_ID, null, "session-1");

        record(entry(AuditAction.TICKET_ARCHIVE), exchange, jwt);

        AuditEvent event = savedEvent();
        assertThat(event.getId()).hasSize(26);
        assertThat(event.getAction()).isEqualTo("ticket.archive");
        assertThat(event.getActorType()).isEqualTo(AuditActorType.USER);
        assertThat(event.getActorId()).isEqualTo(USER_ID);
        assertThat(event.getActorName()).isEqualTo("Anna Kowalski");
        assertThat(event.getActorEmail()).isEqualTo("anna@acme.com");
        assertThat(event.getRoleSnapshot()).containsExactly("ADMIN");
        assertThat(event.getSourceIp()).isEqualTo("203.0.113.24");
        assertThat(event.getUserAgent()).isEqualTo("Chrome");
        assertThat(event.getSessionId()).isEqualTo("session-1");
        assertThat(event.getCorrelationId()).isEqualTo("request-1");
        assertThat(event.getTenantId()).isEqualTo(ROUTED_TENANT_ID);
        assertThat(event.getTargetType()).isEqualTo(AuditTargetType.TICKET);
    }

    @Test
    void recordsStaffUnderTheRoutedTenant() {
        insertSucceeds();
        when(userRepository.findById("staff-1")).thenReturn(Mono.just(new User()));
        ServerWebExchange exchange = MockServerWebExchange.from(MockServerHttpRequest.get("/tools/fleet")
                .header(TenantRoutingHeaders.TENANT_ID_HEADER, ROUTED_TENANT_ID));
        Jwt jwt = jwt("staff-1", "staff@flamingo.cx", List.of("ADMIN"), SUPER_TENANT_ID, null, null);

        record(entry(AuditAction.STAFF_TENANT_ACCESS_START), exchange, jwt);

        AuditEvent event = savedEvent();
        assertThat(event.getActorType()).isEqualTo(AuditActorType.STAFF);
        assertThat(event.getActorName()).isNull();
        assertThat(event.getTenantId()).isEqualTo(ROUTED_TENANT_ID);
    }

    @Test
    void recordsDeviceWithItsHostname() {
        insertSucceeds();
        Machine machine = new Machine();
        machine.setHostname("LAPTOP-7F3A");
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Mono.just(machine));
        ServerWebExchange exchange = MockServerWebExchange.from(MockServerHttpRequest.get("/clients/api"));
        Jwt jwt = jwt(MACHINE_ID, null, List.of("AGENT"), ROUTED_TENANT_ID, MACHINE_ID, null);

        record(entry(AuditAction.DEVICE_REGISTER), exchange, jwt);

        AuditEvent event = savedEvent();
        assertThat(event.getActorType()).isEqualTo(AuditActorType.DEVICE);
        assertThat(event.getActorId()).isEqualTo(MACHINE_ID);
        assertThat(event.getActorName()).isEqualTo("LAPTOP-7F3A");
        assertThat(event.getTenantId()).isEqualTo(ROUTED_TENANT_ID);
        verifyNoInteractions(userRepository);
    }

    @Test
    void recordsApiKeyCallWithTheKeyAndItsOwner() {
        insertSucceeds();
        ApiKey key = ApiKey.builder().keyId("key-1").name("Billing sync").roles(List.of("ADMIN")).build();
        when(apiKeyRepository.findById("key-1")).thenReturn(Mono.just(key));
        when(userRepository.findById(USER_ID)).thenReturn(Mono.just(user("Anna", "Kowalski")));
        ServerWebExchange exchange = MockServerWebExchange.from(MockServerHttpRequest.post("/external-api/tickets")
                .header(X_API_KEY_ID, "key-1")
                .header(X_USER_ID, USER_ID)
                .header(TenantRoutingHeaders.TENANT_ID_HEADER, ROUTED_TENANT_ID));

        recorder.record(entry(AuditAction.TICKET_ARCHIVE), exchange).block();

        AuditEvent event = savedEvent();
        assertThat(event.getActorType()).isEqualTo(AuditActorType.API_KEY);
        assertThat(event.getActorId()).isEqualTo("key-1");
        assertThat(event.getActorName()).isEqualTo("Billing sync");
        assertThat(event.getRoleSnapshot()).containsExactly("ADMIN");
        assertThat(event.getOnBehalfOfId()).isEqualTo(USER_ID);
        assertThat(event.getOnBehalfOfName()).isEqualTo("Anna Kowalski");
        assertThat(event.getTenantId()).isEqualTo(ROUTED_TENANT_ID);
    }

    @Test
    void recordsSystemUnderTheSuperTenantWhenNothingNamesATenant() {
        insertSucceeds();
        ServerWebExchange exchange = MockServerWebExchange.from(MockServerHttpRequest.get("/api/tickets"));

        recorder.record(entry(AuditAction.AUTH_ACCESS_DENY), exchange).block();

        AuditEvent event = savedEvent();
        assertThat(event.getActorType()).isEqualTo(AuditActorType.SYSTEM);
        assertThat(event.getActorName()).isNull();
        assertThat(event.getSessionId()).isNull();
        assertThat(event.getTenantId()).isEqualTo(SUPER_TENANT_ID);
        verifyNoInteractions(userRepository, machineRepository, apiKeyRepository);
    }

    @Test
    void recordsSystemWhenTheSecurityContextHoldsNoAuthentication() {
        insertSucceeds();
        ServerWebExchange exchange = MockServerWebExchange.from(MockServerHttpRequest.get("/api/tickets"));

        recorder.record(entry(AuditAction.AUTH_ACCESS_DENY), exchange)
                .contextWrite(ReactiveSecurityContextHolder.withSecurityContext(Mono.just(new SecurityContextImpl())))
                .block();

        assertThat(savedEvent().getActorType()).isEqualTo(AuditActorType.SYSTEM);
    }

    @Test
    void leavesNameEmptyWhenUserRecordIsGone() {
        insertSucceeds();
        when(userRepository.findById(USER_ID)).thenReturn(Mono.empty());
        ServerWebExchange exchange = MockServerWebExchange.from(MockServerHttpRequest.get("/api/tickets"));
        Jwt jwt = jwt(USER_ID, "anna@acme.com", List.of("ADMIN"), ROUTED_TENANT_ID, null, null);

        record(entry(AuditAction.TICKET_ARCHIVE), exchange, jwt);

        AuditEvent event = savedEvent();
        assertThat(event.getActorId()).isEqualTo(USER_ID);
        assertThat(event.getActorName()).isNull();
    }

    @Test
    void completesWhenTheInsertFails() {
        when(auditEventRepository.insert(any(AuditEvent.class)))
                .thenReturn(Mono.error(new DataAccessResourceFailureException("mongo down")));
        ServerWebExchange exchange = MockServerWebExchange.from(MockServerHttpRequest.get("/api/tickets"));

        recorder.record(entry(AuditAction.AUTH_ACCESS_DENY), exchange).block();

        verify(auditEventRepository).insert(any(AuditEvent.class));
    }

    private void record(AuditEntry entry, ServerWebExchange exchange, Jwt jwt) {
        recorder.record(entry, exchange)
                .contextWrite(ReactiveSecurityContextHolder.withAuthentication(new JwtAuthenticationToken(jwt)))
                .block();
    }

    private void insertSucceeds() {
        when(auditEventRepository.insert(any(AuditEvent.class))).thenAnswer(call -> Mono.just(call.getArgument(0)));
    }

    private AuditEvent savedEvent() {
        verify(auditEventRepository).insert(eventCaptor.capture());
        return eventCaptor.getValue();
    }

    private static AuditEntry entry(AuditAction action) {
        return AuditEntry.builder().action(action).outcome(AuditOutcome.SUCCESS).build();
    }

    private static User user(String firstName, String lastName) {
        User user = new User();
        user.setFirstName(firstName);
        user.setLastName(lastName);
        return user;
    }

    private static Jwt jwt(String subject, String email, List<String> roles, String tenantId, String machineId,
                           String sessionId) {
        Jwt.Builder builder = Jwt.withTokenValue("token")
                .header("alg", "none")
                .subject(subject)
                .claim("roles", roles)
                .claim("tenant_id", tenantId);
        if (email != null) {
            builder.claim("email", email);
        }
        if (machineId != null) {
            builder.claim("machine_id", machineId);
        }
        if (sessionId != null) {
            builder.claim(AuditRequestContext.SESSION_CLAIM, sessionId);
        }
        return builder.build();
    }
}
