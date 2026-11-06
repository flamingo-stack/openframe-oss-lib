package com.openframe.audit;

import com.openframe.audit.targets.AuditTarget;
import com.openframe.audit.targets.AuditTargetRepository;
import com.openframe.audit.targets.AuditTargets;
import com.openframe.audit.targets.LoadedTarget;
import com.openframe.data.document.apikey.ApiKey;
import com.openframe.data.document.audit.AuditActor;
import com.openframe.data.document.audit.AuditAction;
import com.openframe.data.document.audit.AuditActorType;
import com.openframe.data.document.audit.AuditChange;
import com.openframe.data.document.audit.AuditEntry;
import com.openframe.data.document.audit.AuditEvent;
import com.openframe.data.document.audit.AuditOutcome;
import com.openframe.data.document.audit.AuditRequestContext;
import com.openframe.data.document.audit.AuditSource;
import com.openframe.data.document.audit.AuditTargetType;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.user.Invitation;
import com.openframe.data.document.user.User;
import com.openframe.data.mapper.AuditEventMapperImpl;
import com.openframe.data.repository.apikey.ApiKeyRepository;
import com.openframe.data.repository.audit.AuditEventRepository;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.user.UserRepository;
import com.openframe.data.service.AuditTenants;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.support.StaticApplicationContext;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static com.openframe.core.constants.HttpHeaders.X_API_KEY_ID;
import static com.openframe.core.constants.HttpHeaders.X_USER_ID;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuditRecorderTest {

    private static final String SUPER_TENANT_ID = "super-tenant";
    private static final String SERVED_TENANT_ID = "tenant-1";
    private static final String USER_ID = "user-1";
    private static final String MACHINE_ID = "machine-1";

    @Mock private AuditEventRepository auditEventRepository;
    @Mock private UserRepository userRepository;
    @Mock private MachineRepository machineRepository;
    @Mock private ApiKeyRepository apiKeyRepository;
    @Mock private TenantIdProvider tenantIdProvider;
    @Mock private AuditTargetRepository targetRepository;
    @Captor private ArgumentCaptor<AuditEvent> eventCaptor;

    private AuditRecorder recorder;

    @BeforeEach
    void setUp() {
        recorder = recorder(SUPER_TENANT_ID, true);
        lenient().when(auditEventRepository.insert(any(AuditEvent.class))).thenAnswer(call -> call.getArgument(0));
    }

    @AfterEach
    void clearContexts() {
        SecurityContextHolder.clearContext();
        RequestContextHolder.resetRequestAttributes();
    }

    @Test
    void recordsTechnicianActionWithTokenAndHeaders() {
        signIn(jwt(USER_ID, "anna@acme.com", List.of("ADMIN"), SERVED_TENANT_ID, null, "session-1"));
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(AuditRequestContext.CLIENT_IP_HEADER, "203.0.113.24");
        request.addHeader("User-Agent", "Chrome");
        request.addHeader(AuditRequestContext.REQUEST_ID_HEADER, "request-1");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user("Anna", "Kowalski")));
        Instant before = Instant.now();

        recorder.record(AuditEntry.builder()
                .action(AuditAction.TICKET_ARCHIVE)
                .outcome(AuditOutcome.SUCCESS)
                .targetId("ticket-1")
                .targetName("Printer offline")
                .organizationId("org-1")
                .deviceId("device-1")
                .parentEventId("parent-1")
                .details(Map.of("statusKind", "RESOLVED"))
                .changes(Map.of("status", new AuditChange("OPEN", "ARCHIVED")))
                .build());

        AuditEvent event = savedEvent();
        assertThat(event.getId()).hasSize(26);
        assertThat(event.getSchemaVersion()).isEqualTo(AuditEvent.SCHEMA_VERSION);
        assertThat(event.getOccurredAt()).isBetween(before, Instant.now());
        assertThat(event.getAction()).isEqualTo("ticket.archive");
        assertThat(event.getOutcome()).isEqualTo(AuditOutcome.SUCCESS);
        assertThat(event.getActorType()).isEqualTo(AuditActorType.USER);
        assertThat(event.getActorId()).isEqualTo(USER_ID);
        assertThat(event.getActorName()).isEqualTo("Anna Kowalski");
        assertThat(event.getActorEmail()).isEqualTo("anna@acme.com");
        assertThat(event.getRoleSnapshot()).containsExactly("ADMIN");
        assertThat(event.getOnBehalfOfId()).isNull();
        assertThat(event.getSourceIp()).isEqualTo("203.0.113.24");
        assertThat(event.getUserAgent()).isEqualTo("Chrome");
        assertThat(event.getSessionId()).isEqualTo("session-1");
        assertThat(event.getCorrelationId()).isEqualTo("request-1");
        assertThat(event.getParentEventId()).isEqualTo("parent-1");
        assertThat(event.getTenantId()).isEqualTo(SERVED_TENANT_ID);
        assertThat(event.getOrganizationId()).isEqualTo("org-1");
        assertThat(event.getDeviceId()).isEqualTo("device-1");
        assertThat(event.getTargetType()).isEqualTo(AuditTargetType.TICKET);
        assertThat(event.getTargetId()).isEqualTo("ticket-1");
        assertThat(event.getTargetName()).isEqualTo("Printer offline");
        assertThat(event.getDetails()).containsEntry("statusKind", "RESOLVED");
        assertThat(event.getChanges()).containsEntry("status", new AuditChange("OPEN", "ARCHIVED"));
    }

    @Test
    void recordsStaffUnderTheServedTenant() {
        signIn(jwt("staff-1", "staff@flamingo.cx", List.of("ADMIN"), SUPER_TENANT_ID, null, null));
        when(userRepository.findById("staff-1")).thenReturn(Optional.of(user("John", null)));
        when(tenantIdProvider.getTenantId()).thenReturn(SERVED_TENANT_ID);

        recorder.record(entry(AuditAction.TICKET_ARCHIVE));

        AuditEvent event = savedEvent();
        assertThat(event.getActorType()).isEqualTo(AuditActorType.STAFF);
        assertThat(event.getActorName()).isEqualTo("John");
        assertThat(event.getTenantId()).isEqualTo(SERVED_TENANT_ID);
    }

    @Test
    void recordsDeviceWithItsHostname() {
        signIn(jwt(MACHINE_ID, null, List.of("AGENT"), SERVED_TENANT_ID, MACHINE_ID, null));
        Machine machine = new Machine();
        machine.setHostname("LAPTOP-7F3A");
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));

        recorder.record(entry(AuditAction.DEVICE_REGISTER));

        AuditEvent event = savedEvent();
        assertThat(event.getActorType()).isEqualTo(AuditActorType.DEVICE);
        assertThat(event.getActorId()).isEqualTo(MACHINE_ID);
        assertThat(event.getActorName()).isEqualTo("LAPTOP-7F3A");
        assertThat(event.getActorEmail()).isNull();
        verifyNoInteractions(userRepository);
    }

    @Test
    void recordsApiKeyCallWithTheKeyAndItsOwner() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(X_API_KEY_ID, "key-1");
        request.addHeader(X_USER_ID, USER_ID);
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
        ApiKey key = ApiKey.builder().keyId("key-1").name("Billing sync").roles(List.of("ADMIN")).build();
        when(apiKeyRepository.findById("key-1")).thenReturn(Optional.of(key));
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user("Anna", "Kowalski")));
        when(tenantIdProvider.getTenantId()).thenReturn(SERVED_TENANT_ID);

        recorder.record(entry(AuditAction.TICKET_ARCHIVE));

        AuditEvent event = savedEvent();
        assertThat(event.getActorType()).isEqualTo(AuditActorType.API_KEY);
        assertThat(event.getActorId()).isEqualTo("key-1");
        assertThat(event.getActorName()).isEqualTo("Billing sync");
        assertThat(event.getRoleSnapshot()).containsExactly("ADMIN");
        assertThat(event.getOnBehalfOfId()).isEqualTo(USER_ID);
        assertThat(event.getOnBehalfOfName()).isEqualTo("Anna Kowalski");
        assertThat(event.getSessionId()).isNull();
        assertThat(event.getTenantId()).isEqualTo(SERVED_TENANT_ID);
    }

    @Test
    void recordsAnUnknownApiKeyByItsId() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(X_API_KEY_ID, "key-9");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
        when(apiKeyRepository.findById("key-9")).thenReturn(Optional.empty());
        when(tenantIdProvider.getTenantId()).thenReturn(SERVED_TENANT_ID);

        recorder.record(entry(AuditAction.TICKET_ARCHIVE));

        AuditEvent event = savedEvent();
        assertThat(event.getActorType()).isEqualTo(AuditActorType.API_KEY);
        assertThat(event.getActorId()).isEqualTo("key-9");
        assertThat(event.getActorName()).isNull();
        assertThat(event.getRoleSnapshot()).isEmpty();
        assertThat(event.getOnBehalfOfId()).isNull();
    }

    @Test
    void recordsSystemWhenThereIsNoTokenAndNoApiKey() {
        when(tenantIdProvider.getTenantId()).thenReturn(SERVED_TENANT_ID);

        recorder.record(entry(AuditAction.TICKET_ARCHIVE));

        AuditEvent event = savedEvent();
        assertThat(event.getActorType()).isEqualTo(AuditActorType.SYSTEM);
        assertThat(event.getActorId()).isNull();
        assertThat(event.getActorName()).isNull();
        assertThat(event.getRoleSnapshot()).isEmpty();
        assertThat(event.getSourceIp()).isNull();
        assertThat(event.getSessionId()).isNull();
        assertThat(event.getTenantId()).isEqualTo(SERVED_TENANT_ID);
        verifyNoInteractions(userRepository, machineRepository, apiKeyRepository);
    }

    @Test
    void leavesNameEmptyWhenUserRecordIsGone() {
        signIn(jwt(USER_ID, "anna@acme.com", List.of("ADMIN"), SERVED_TENANT_ID, null, null));
        when(userRepository.findById(USER_ID)).thenReturn(Optional.empty());

        recorder.record(entry(AuditAction.TICKET_ARCHIVE));

        AuditEvent event = savedEvent();
        assertThat(event.getActorId()).isEqualTo(USER_ID);
        assertThat(event.getActorEmail()).isEqualTo("anna@acme.com");
        assertThat(event.getActorName()).isNull();
    }

    @Test
    void recordsUnderThePlatformTenantInASharedService() {
        recorder(SUPER_TENANT_ID, false).record(entry(AuditAction.AUTH_LOGIN_FAIL));

        assertThat(savedEvent().getTenantId()).isEqualTo(SUPER_TENANT_ID);
        verifyNoInteractions(tenantIdProvider);
    }

    @Test
    void recordsUnderTheServedTenantWhereNoSuperTenantIsConfigured() {
        when(tenantIdProvider.getTenantId()).thenReturn("oss");

        recorder("", false).record(entry(AuditAction.AUTH_LOGIN_FAIL));

        assertThat(savedEvent().getTenantId()).isEqualTo("oss");
    }

    @Test
    void prefersTheTenantTheCallerPasses() {
        signIn(jwt(USER_ID, "anna@acme.com", List.of("ADMIN"), SERVED_TENANT_ID, null, null));
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user("Anna", "Kowalski")));

        recorder.record(AuditEntry.builder()
                .action(AuditAction.TICKET_ARCHIVE)
                .outcome(AuditOutcome.SUCCESS)
                .tenantId("tenant-2")
                .build());

        assertThat(savedEvent().getTenantId()).isEqualTo("tenant-2");
    }

    @Test
    void takesTheTargetTypeFromTheEntryWhenTheActionHasNone() {
        when(tenantIdProvider.getTenantId()).thenReturn(SERVED_TENANT_ID);

        recorder.record(AuditEntry.builder()
                .action(AuditAction.LINK_CREATE)
                .outcome(AuditOutcome.SUCCESS)
                .targetType(AuditTargetType.KB_ARTICLE)
                .build());

        assertThat(savedEvent().getTargetType()).isEqualTo(AuditTargetType.KB_ARTICLE);
    }

    @Test
    void logsAndReturnsWhenTheInsertFails() {
        when(tenantIdProvider.getTenantId()).thenReturn(SERVED_TENANT_ID);
        when(auditEventRepository.insert(any(AuditEvent.class)))
                .thenThrow(new DataAccessResourceFailureException("mongo down"));

        recorder.record(entry(AuditAction.TICKET_ARCHIVE));

        verify(auditEventRepository).insert(any(AuditEvent.class));
    }

    @Test
    void refusesAnEntryWithoutOutcome() {
        assertThatThrownBy(() -> recorder.record(AuditEntry.builder().action(AuditAction.TICKET_ARCHIVE).build()))
                .isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(auditEventRepository);
    }

    @Test
    void fillsTheTargetNameOrganizationAndDeviceFromTheStoredTarget() {
        AuditTarget<User> userTarget = AuditTarget.of(AuditTargetType.USER, User.class, User::fullName)
                .withOrganizationId(_ -> "org-7")
                .withDeviceId(_ -> "device-7");
        when(tenantIdProvider.getTenantId()).thenReturn(SERVED_TENANT_ID);
        when(targetRepository.load(anyList(), eq("user-9")))
                .thenReturn(Optional.of(new LoadedTarget(userTarget, user("Ola", "Nowak"))));

        recorder(SUPER_TENANT_ID, true, new AuditTargets(List.of(() -> List.of(userTarget))))
                .record(AuditEntry.builder()
                        .action(AuditAction.USER_UPDATE)
                        .outcome(AuditOutcome.SUCCESS)
                        .targetId("user-9")
                        .build());

        AuditEvent event = savedEvent();
        assertThat(event.getTargetName()).isEqualTo("Ola Nowak");
        assertThat(event.getOrganizationId()).isEqualTo("org-7");
        assertThat(event.getDeviceId()).isEqualTo("device-7");
    }

    @Test
    void keepsTheNameTheCallerGaveOverTheStoredOne() {
        AuditTarget<User> userTarget = AuditTarget.of(AuditTargetType.USER, User.class, User::fullName);
        when(tenantIdProvider.getTenantId()).thenReturn(SERVED_TENANT_ID);
        when(targetRepository.load(anyList(), eq("user-9")))
                .thenReturn(Optional.of(new LoadedTarget(userTarget, user("Ola", "Nowak"))));

        recorder(SUPER_TENANT_ID, true, new AuditTargets(List.of(() -> List.of(userTarget))))
                .record(AuditEntry.builder()
                        .action(AuditAction.USER_UPDATE)
                        .outcome(AuditOutcome.SUCCESS)
                        .targetId("user-9")
                        .targetName("Name at the time")
                        .build());

        assertThat(savedEvent().getTargetName()).isEqualTo("Name at the time");
    }

    @Test
    void storesTheEventWithoutItsNameWhenTheTargetCannotBeRead() {
        AuditTarget<User> userTarget = AuditTarget.of(AuditTargetType.USER, User.class, User::fullName);
        when(tenantIdProvider.getTenantId()).thenReturn(SERVED_TENANT_ID);
        when(targetRepository.load(anyList(), eq("user-9")))
                .thenThrow(new DataAccessResourceFailureException("mongo down"));

        recorder(SUPER_TENANT_ID, true, new AuditTargets(List.of(() -> List.of(userTarget))))
                .record(AuditEntry.builder()
                        .action(AuditAction.USER_UPDATE)
                        .outcome(AuditOutcome.SUCCESS)
                        .targetId("user-9")
                        .build());

        AuditEvent event = savedEvent();
        assertThat(event.getTargetId()).isEqualTo("user-9");
        assertThat(event.getTargetName()).isNull();
    }

    @Test
    void storesTheHashOfASecretTargetId() {
        AuditTarget<Invitation> invitationTarget =
                AuditTarget.of(AuditTargetType.INVITATION, Invitation.class, Invitation::getEmail).withSecretId(true);
        when(tenantIdProvider.getTenantId()).thenReturn(SERVED_TENANT_ID);

        recorder(SUPER_TENANT_ID, true, new AuditTargets(List.of(() -> List.of(invitationTarget))))
                .record(AuditEntry.builder()
                        .action(AuditAction.INVITATION_REVOKE)
                        .outcome(AuditOutcome.SUCCESS)
                        .targetId("join-secret")
                        .targetName("new@acme.com")
                        .build());

        AuditEvent event = savedEvent();
        assertThat(event.getTargetId()).hasSize(64).doesNotContain("join-secret");
        assertThat(event.getTargetName()).isEqualTo("new@acme.com");
    }

    @Test
    void skipsAnEntryWithoutATargetType() {
        recorder.record(entry(AuditAction.LINK_CREATE));

        verifyNoInteractions(auditEventRepository);
    }

    @Test
    void recordsNothingWhenAuditIsOff() {
        new AuditRecorder(auditEventRepository, userRepository, machineRepository, apiKeyRepository,
                new AuditTenants(tenantIdProvider, SUPER_TENANT_ID, true), new AuditTargets(List.of()),
                targetRepository, outcomeResolver(), new AuditEventMapperImpl(), new ObjectMapper(), false)
                .record(entry(AuditAction.TICKET_ARCHIVE));

        verifyNoInteractions(auditEventRepository);
    }

    @Test
    void recordsWithTheActorTheRequestDeclared() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setAttribute(AuditRequestContext.ACTOR_ATTRIBUTE, AuditActor.staff("staff-2"));
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
        when(tenantIdProvider.getTenantId()).thenReturn(SERVED_TENANT_ID);

        recorder.record(entry(AuditAction.TICKET_ARCHIVE));

        AuditEvent event = savedEvent();
        assertThat(event.getActorType()).isEqualTo(AuditActorType.STAFF);
        assertThat(event.getActorId()).isEqualTo("staff-2");
    }

    @Test
    void recordsInsideADeclaredContextWithItsActorSourceAndParent() {
        when(tenantIdProvider.getTenantId()).thenReturn(SERVED_TENANT_ID);
        AuditContext context = new AuditContext(AuditActor.mingo(USER_ID),
                new AuditSource("203.0.113.5", "Mingo", "request-7", "session-7"), "parent-7");
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user("Anna", "Kowalski")));

        recorder.within(context, () -> recorder.record(entry(AuditAction.TICKET_ARCHIVE)));

        AuditEvent event = savedEvent();
        assertThat(event.getActorType()).isEqualTo(AuditActorType.MINGO);
        assertThat(event.getOnBehalfOfName()).isEqualTo("Anna Kowalski");
        assertThat(event.getSourceIp()).isEqualTo("203.0.113.5");
        assertThat(event.getSessionId()).isEqualTo("session-7");
        assertThat(event.getParentEventId()).isEqualTo("parent-7");
        assertThat(recorder.currentEventId()).isNull();
    }

    @Test
    void recordsTheSessionTheCallerNamesInsteadOfTheTokenOne() {
        signIn(jwt(USER_ID, "anna@acme.com", List.of("ADMIN"), SERVED_TENANT_ID, null, null));
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user("Anna", "Kowalski")));
        AuditActor anna = recorder.userActor(USER_ID, "anna@acme.com", List.of("ADMIN"), SERVED_TENANT_ID);

        recorder.record(entry(AuditAction.AUTH_LOGOUT),
                new AuditContext(anna, recorder.source().withSessionId("ended-session"), null));

        assertThat(savedEvent().getSessionId()).isEqualTo("ended-session");
    }

    @Test
    void recordsTheSameRefusalOnceAMinutePerKeyAndActor() {
        when(tenantIdProvider.getTenantId()).thenReturn(SERVED_TENANT_ID);
        AuditEntry denial = AuditEntry.builder()
                .action(AuditAction.AUTH_ACCESS_DENY)
                .outcome(AuditOutcome.REFUSED)
                .build();

        recorder.recordOnce(denial, "GET /api/users");
        recorder.recordOnce(denial, "GET /api/users");
        recorder.recordOnce(denial, "GET /api/devices");

        verify(auditEventRepository, times(2)).insert(any(AuditEvent.class));
    }

    @Test
    void recordsARepeatedFailureOnceUntilItIsResolved() {
        when(tenantIdProvider.getTenantId()).thenReturn(SERVED_TENANT_ID);
        AuditEntry failure = AuditEntry.builder()
                .action(AuditAction.TICKET_ARCHIVE)
                .outcome(AuditOutcome.FAILURE)
                .build();

        recorder.recordUnresolvedFailure(failure, "invoice-1");
        recorder.recordUnresolvedFailure(failure, "invoice-1");
        verify(auditEventRepository).insert(any(AuditEvent.class));

        recorder.failureResolved(AuditAction.TICKET_ARCHIVE, "invoice-1");
        recorder.recordUnresolvedFailure(failure, "invoice-1");
        verify(auditEventRepository, times(2)).insert(any(AuditEvent.class));
    }

    @Test
    void recordsTheFailureAgainWhenItsEventWasNotStored() {
        when(tenantIdProvider.getTenantId()).thenReturn(SERVED_TENANT_ID);
        when(auditEventRepository.insert(any(AuditEvent.class)))
                .thenThrow(new DataAccessResourceFailureException("mongo down"))
                .thenAnswer(call -> call.getArgument(0));
        AuditEntry failure = AuditEntry.builder()
                .action(AuditAction.TICKET_ARCHIVE)
                .outcome(AuditOutcome.FAILURE)
                .build();

        recorder.recordUnresolvedFailure(failure, "invoice-1");
        recorder.recordUnresolvedFailure(failure, "invoice-1");
        recorder.recordUnresolvedFailure(failure, "invoice-1");

        verify(auditEventRepository, times(2)).insert(any(AuditEvent.class));
    }

    @Test
    void recordsAJobUnderItsName() {
        when(tenantIdProvider.getTenantId()).thenReturn(SERVED_TENANT_ID);

        recorder.within(recorder.context(AuditActor.system("script-watchdog")),
                () -> recorder.record(entry(AuditAction.TICKET_ARCHIVE)));

        AuditEvent event = savedEvent();
        assertThat(event.getActorType()).isEqualTo(AuditActorType.SYSTEM);
        assertThat(event.getActorId()).isEqualTo("script-watchdog");
        assertThat(event.getActorName()).isEqualTo("script-watchdog");
    }

    @Test
    void recordsAFailureOutsideACaptureAndSkipsItInside() {
        when(tenantIdProvider.getTenantId()).thenReturn(SERVED_TENANT_ID);
        AuditEntry denial = AuditEntry.builder()
                .action(AuditAction.AUTH_ACCESS_DENY)
                .outcome(AuditOutcome.REFUSED)
                .build();

        recorder.capturing(null, () -> {
            recorder.recordUnlessCaptured(denial);
            return null;
        });
        verify(auditEventRepository, never()).insert(any(AuditEvent.class));

        recorder.recordUnlessCaptured(denial);
        verify(auditEventRepository).insert(any(AuditEvent.class));
    }

    @Test
    void knowsAFailureACaptureAlreadyRecordedAlsoWhenItIsWrapped() {
        RuntimeException failure = new IllegalStateException("refused");
        recorder.markCaptured(failure);

        assertThat(recorder.captured(failure)).isTrue();
        assertThat(recorder.captured(new RuntimeException(failure))).isTrue();
        assertThat(recorder.captured(new IllegalStateException("another"))).isFalse();
    }

    @Test
    void recordsAFailureWithTheOutcomeOfItsException() {
        when(tenantIdProvider.getTenantId()).thenReturn(SERVED_TENANT_ID);

        recorder.recordFailure(AuditEntry.builder().action(AuditAction.TICKET_ARCHIVE),
                new IllegalArgumentException("Ticket is archived"));

        AuditEvent event = savedEvent();
        assertThat(event.getOutcome()).isEqualTo(AuditOutcome.REFUSED);
        assertThat(event.getReason()).isEqualTo("Ticket is archived");
    }

    private AuditRecorder recorder(String superTenantId, boolean servesOneTenant) {
        return recorder(superTenantId, servesOneTenant, new AuditTargets(List.of()));
    }

    private AuditRecorder recorder(String superTenantId, boolean servesOneTenant, AuditTargets targets) {
        return new AuditRecorder(auditEventRepository, userRepository, machineRepository, apiKeyRepository,
                new AuditTenants(tenantIdProvider, superTenantId, servesOneTenant), targets, targetRepository,
                outcomeResolver(), new AuditEventMapperImpl(), new ObjectMapper(), true);
    }

    private static AuditOutcomeResolver outcomeResolver() {
        return new AuditOutcomeResolver(List.of(), new ExceptionHandlerStatuses(new StaticApplicationContext()));
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

    private static void signIn(Jwt jwt) {
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt));
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
