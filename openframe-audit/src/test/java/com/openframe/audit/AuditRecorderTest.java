package com.openframe.audit;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.openframe.audit.targets.AuditTarget;
import com.openframe.audit.targets.AuditTargetRegistry;
import com.openframe.audit.targets.AuditTargetRepository;
import com.openframe.audit.targets.LoadedTarget;
import com.openframe.data.document.apikey.ApiKey;
import com.openframe.data.document.audit.AuditAction;
import com.openframe.data.document.audit.AuditActorType;
import com.openframe.data.document.audit.AuditChange;
import com.openframe.data.document.audit.AuditEvent;
import com.openframe.data.document.audit.AuditOutcome;
import com.openframe.data.document.audit.AuditTargetType;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.tenant.SSOPerTenantConfig;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.user.Invitation;
import com.openframe.data.document.user.User;
import com.openframe.data.mapper.AuditEventMapper;
import com.openframe.data.model.audit.AuditActor;
import com.openframe.data.model.audit.AuditEntry;
import com.openframe.data.model.audit.AuditRequestInfo;
import com.openframe.data.repository.apikey.ApiKeyRepository;
import com.openframe.data.repository.audit.AuditEventRepository;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.user.UserRepository;
import com.openframe.data.service.AuditClock;
import com.openframe.data.service.AuditTenantResolver;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;
import java.util.stream.Stream;

import static com.openframe.core.constants.HttpHeaders.X_API_KEY_ID;
import static com.openframe.core.constants.HttpHeaders.X_USER_ID;
import static com.openframe.data.model.audit.AuditConstants.ACTOR_ATTRIBUTE;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
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
    private static final String ENDPOINT = "GET /api/users";
    private static final Instant OCCURRED_AT = Instant.parse("2026-10-28T14:12:00Z");
    private static final RuntimeException CAPTURED_FAILURE = new IllegalStateException("Ticket is archived");
    private static final AuditRequestInfo REQUEST_INFO =
            new AuditRequestInfo("203.0.113.5", "Mingo", "request-7", "session-7");
    private static final AuditTarget<Ticket> TICKET_TARGET =
            AuditTarget.of(AuditTargetType.TICKET, Ticket.class, Ticket::getTitle)
                    .withOrganizationId(Ticket::getOrganizationId)
                    .withDeviceId(Ticket::getDeviceId);

    @Mock private AuditEventRepository auditEventRepository;
    @Mock private UserRepository userRepository;
    @Mock private MachineRepository machineRepository;
    @Mock private ApiKeyRepository apiKeyRepository;
    @Mock private AuditTenantResolver tenantResolver;
    @Mock private AuditTargetRepository targetRepository;
    @Mock private AuditOutcomeResolver outcomeResolver;
    @Mock private AuditEventMapper auditEventMapper;
    @Mock private AuditClock auditClock;
    @Captor private ArgumentCaptor<AuditEvent> eventCaptor;
    @Captor private ArgumentCaptor<AuditEntry> entryCaptor;

    private final Logger logger = (Logger) LoggerFactory.getLogger(AuditRecorder.class);
    private final ListAppender<ILoggingEvent> appender = new ListAppender<>();
    private AuditContext seenInside;

    private AuditRecorder recorder;

    @BeforeEach
    void setUp() {
        recorder = recorder(new AuditTargetRegistry(List.of()));
        appender.start();
        logger.addAppender(appender);
    }

    @AfterEach
    void clearContexts() {
        SecurityContextHolder.clearContext();
        RequestContextHolder.resetRequestAttributes();
        logger.detachAppender(appender);
    }

    @Test
    void context_userToken_isTheUserOfTheToken() {
        when(tenantResolver.superTenantId()).thenReturn(SUPER_TENANT_ID);
        signIn(USER_ID, SERVED_TENANT_ID, Map.of("email", "anna@acme.com", "roles", List.of("ADMIN")));

        assertThat(recorder.context().actor()).isEqualTo(
                AuditActor.fromUser(USER_ID, "anna@acme.com", List.of("ADMIN"), SERVED_TENANT_ID, SUPER_TENANT_ID));
    }

    @Test
    void context_platformTenantToken_isStaff() {
        when(tenantResolver.superTenantId()).thenReturn(SUPER_TENANT_ID);
        signIn("staff-1", SUPER_TENANT_ID, Map.of("roles", List.of("ADMIN")));

        assertThat(recorder.context().actor().type()).isEqualTo(AuditActorType.STAFF);
    }

    @Test
    void context_agentToken_isTheDeviceOfItsMachine() {
        signIn("agent-client", SERVED_TENANT_ID, Map.of("roles", List.of("AGENT"), "machine_id", MACHINE_ID));

        assertThat(recorder.context().actor())
                .isEqualTo(AuditActor.fromAgent(MACHINE_ID, List.of("AGENT"), SERVED_TENANT_ID));
    }

    @Test
    void context_requestDeclaresAnActor_takesItOverTheToken() {
        signIn(USER_ID, SERVED_TENANT_ID, Map.of("roles", List.of("ADMIN")));
        currentRequest().setAttribute(ACTOR_ATTRIBUTE, AuditActor.staff("staff-2"));

        assertThat(recorder.context().actor()).isEqualTo(AuditActor.staff("staff-2"));
    }

    @Test
    void context_tokenAndApiKeyHeader_takesTheTokenActor() {
        when(tenantResolver.superTenantId()).thenReturn(SUPER_TENANT_ID);
        signIn(USER_ID, SERVED_TENANT_ID, Map.of("email", "anna@acme.com", "roles", List.of("ADMIN")));
        currentRequest().addHeader(X_API_KEY_ID, "key-1");

        assertThat(recorder.context().actor()).isEqualTo(
                AuditActor.fromUser(USER_ID, "anna@acme.com", List.of("ADMIN"), SERVED_TENANT_ID, SUPER_TENANT_ID));
    }

    @Test
    void context_apiKeyHeader_isTheKeyActingForItsOwner() {
        MockHttpServletRequest request = currentRequest();
        request.addHeader(X_API_KEY_ID, "key-1");
        request.addHeader(X_USER_ID, USER_ID);
        when(apiKeyRepository.findById("key-1")).thenReturn(Optional.of(ApiKey.builder()
                .keyId("key-1")
                .name("Billing sync")
                .roles(List.of("ADMIN"))
                .tenantId("tenant-3")
                .build()));

        assertThat(recorder.context().actor())
                .isEqualTo(AuditActor.fromApiKey("key-1", "Billing sync", List.of("ADMIN"), "tenant-3", USER_ID));
    }

    @Test
    void context_unknownApiKey_isTheKeyByItsId() {
        MockHttpServletRequest request = currentRequest();
        request.addHeader(X_API_KEY_ID, "key-9");
        request.addHeader(X_USER_ID, USER_ID);
        when(apiKeyRepository.findById("key-9")).thenReturn(Optional.empty());

        assertThat(recorder.context().actor()).isEqualTo(AuditActor.fromApiKey("key-9", null, null, null, USER_ID));
    }

    @Test
    void context_noTokenAndNoApiKey_isTheSystem() {
        currentRequest();

        assertThat(recorder.context().actor()).isEqualTo(AuditActor.system());
    }

    @Test
    void context_actorGivenOutsideAnyContext_takesTheSourceOfTheRequest() {
        currentRequest().addHeader("X-Client-Ip", "203.0.113.24");
        AuditActor job = AuditActor.system("invoice-sync");

        assertThat(recorder.context(job))
                .extracting(AuditContext::actor, context -> context.requestInfo().ip(), AuditContext::currentEventId)
                .containsExactly(job, "203.0.113.24", null);
    }

    @Test
    void context_actorGivenInsideADeclaredContext_keepsItsSourceAndEvent() {
        AuditActor job = AuditActor.system("invoice-sync");

        AuditContext context = recorder.within(declaredContext("event-1"), () -> recorder.context(job));

        assertThat(context).isEqualTo(new AuditContext(job, REQUEST_INFO, "event-1"));
    }

    @Test
    void requestInfo_tokenWithSessionAndALoginSession_takesTheTokensSession() {
        signIn(USER_ID, SERVED_TENANT_ID, Map.of("roles", List.of("ADMIN"), "sid", "session-1"));
        currentRequest().setSession(new MockHttpSession(null, "login-session"));

        assertThat(recorder.requestInfo().sessionId()).isEqualTo("session-1");
    }

    @Test
    void requestInfo_loginSessionWithoutToken_isTheHashOfTheSessionId() {
        currentRequest().setSession(new MockHttpSession(null, "abc"));

        assertThat(recorder.requestInfo().sessionId())
                .isEqualTo("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    }

    @Test
    void requestInfo_noTokenAndNoLoginSession_hasNoSession() {
        currentRequest();

        assertThat(recorder.requestInfo().sessionId()).isNull();
    }

    @Test
    void requestInfo_noRequest_isEmpty() {
        assertThat(recorder.requestInfo()).isEqualTo(new AuditRequestInfo(null, null, null, null));
    }

    @Test
    void userActor_platformTenant_isStaff() {
        when(tenantResolver.superTenantId()).thenReturn(SUPER_TENANT_ID);

        AuditActor actor = recorder.userActor("staff-1", "staff@flamingo.cx", List.of("ADMIN"), SUPER_TENANT_ID);

        assertThat(actor.type()).isEqualTo(AuditActorType.STAFF);
    }

    @Test
    void record_entryInContext_storesTheEventBuiltFromTheContextTheResolvedTenantAndTheClock() {
        AuditActor job = AuditActor.system("invoice-sync");
        when(tenantResolver.tenantFor(job, "tenant-2")).thenReturn("tenant-7");
        when(auditClock.now()).thenReturn(OCCURRED_AT);
        AuditEvent event = storesEvent();

        recorder.record(entry(AuditAction.TICKET_ARCHIVE).toBuilder().tenantId("tenant-2").build(),
                new AuditContext(job, REQUEST_INFO, "event-0"));

        verify(auditEventMapper).toEvent(any(), eq(job), eq(REQUEST_INFO), eq("tenant-7"), eq("event-0"),
                eq(OCCURRED_AT));
        verify(auditEventRepository).insert(event);
    }

    @Test
    void record_entryWithoutTargetType_passesItsFieldsOnWithTheActionsTargetType() {
        storesEvent();

        recorder.record(AuditEntry.builder()
                .action(AuditAction.TICKET_ARCHIVE)
                .outcome(AuditOutcome.REFUSED)
                .reason("Ticket is archived")
                .targetId("ticket-1")
                .targetName("Printer offline")
                .organizationId("org-1")
                .deviceId("device-1")
                .details(Map.of("statusKind", "RESOLVED"))
                .changes(Map.of("status", new AuditChange("OPEN", "ARCHIVED")))
                .build());

        assertThat(mappedEntry())
                .extracting(AuditEntry::getTargetType, AuditEntry::getOutcome, AuditEntry::getReason,
                        AuditEntry::getTargetId, AuditEntry::getTargetName, AuditEntry::getOrganizationId,
                        AuditEntry::getDeviceId, AuditEntry::getDetails, AuditEntry::getChanges)
                .containsExactly(AuditTargetType.TICKET, AuditOutcome.REFUSED, "Ticket is archived", "ticket-1",
                        "Printer offline", "org-1", "device-1", Map.of("statusKind", "RESOLVED"),
                        Map.of("status", new AuditChange("OPEN", "ARCHIVED")));
    }

    @Test
    void record_actionOfSeveralTargetKindsWithTheKindNamed_passesItOnWithTheNamedType() {
        storesEvent();

        recorder.record(entry(AuditAction.LINK_CREATE).toBuilder().targetType(AuditTargetType.KB_ARTICLE).build());

        assertThat(mappedEntry().getTargetType()).isEqualTo(AuditTargetType.KB_ARTICLE);
    }

    @Test
    void record_actionOfSeveralTargetKindsWithoutTheKind_logsTheSkipAndRecordsNothing() {
        String eventId = recorder.record(entry(AuditAction.LINK_CREATE));

        assertThat(eventId).isNull();
        assertThat(appender.list).extracting(ILoggingEvent::getFormattedMessage)
                .containsExactly("Audit skipped: link.create has no fixed target type, so the entry must name one");
        verifyNoInteractions(auditEventMapper);
    }

    @ParameterizedTest
    @MethodSource("incompleteEntries")
    void record_incompleteEntry_throws(AuditEntry entry, String message) {
        assertThatThrownBy(() -> recorder.record(entry))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage(message);
    }

    @Test
    void record_auditOff_recordsNothing() {
        String eventId = recorder(new AuditTargetRegistry(List.of()), false).record(entry(AuditAction.TICKET_ARCHIVE));

        assertThat(eventId).isNull();
        verifyNoInteractions(auditEventMapper);
    }

    @Test
    void record_eventStored_returnsItsId() {
        storesEvent();

        String eventId = recorder.record(entry(AuditAction.TICKET_ARCHIVE), AuditActor.system("invoice-sync"));

        assertThat(eventId).isEqualTo("event-1");
    }

    @Test
    void record_insertFails_logsTheWholeEventAsJsonAndReturnsNoId() {
        AuditEvent event = mapsTo(AuditEvent.builder().id("event-1").action("ticket.archive").build());
        when(auditEventRepository.insert(event)).thenThrow(new DataAccessResourceFailureException("mongo down"));

        String eventId = recorder.record(entry(AuditAction.TICKET_ARCHIVE));

        assertThat(eventId).isNull();
        assertThat(appender.list).singleElement().satisfies(logged -> {
            assertThat(logged.getLevel()).isEqualTo(Level.ERROR);
            assertThat(logged.getFormattedMessage())
                    .startsWith("Audit event not stored: {")
                    .contains("\"id\":\"event-1\"", "\"action\":\"ticket.archive\"");
            assertThat(logged.getThrowableProxy().getClassName())
                    .isEqualTo(DataAccessResourceFailureException.class.getName());
        });
    }

    @Test
    void record_insertFailsForAnEventJsonCannotWrite_logsTheEventAsText() {
        Map<String, Object> cyclicDetails = new HashMap<>();
        cyclicDetails.put("result", cyclicDetails);
        AuditEvent event = mapsTo(AuditEvent.builder().id("event-1").details(cyclicDetails).build());
        when(auditEventRepository.insert(event)).thenThrow(new DataAccessResourceFailureException("mongo down"));

        recorder.record(entry(AuditAction.TICKET_ARCHIVE));

        assertThat(appender.list).extracting(ILoggingEvent::getFormattedMessage).singleElement().asString()
                .startsWith("Audit event not stored: AuditEvent(id=event-1,");
    }

    @Test
    void record_actorNameReadBreaks_logsAndReturnsNoId() {
        when(userRepository.findById("staff-1"))
                .thenThrow(new IllegalArgumentException("No enum constant UserStatus.ARCHIVED"));

        String eventId = recorder.record(entry(AuditAction.TICKET_ARCHIVE), AuditActor.staff("staff-1"));

        assertThat(eventId).isNull();
        assertThat(appender.list).extracting(ILoggingEvent::getFormattedMessage)
                .containsExactly("Audit event not recorded for ticket.archive");
    }

    @Test
    void record_contextWithoutEventInsideADeclaredEvent_hangsUnderIt() {
        storesEvent();
        AuditContext own = new AuditContext(AuditActor.system("invoice-sync"), REQUEST_INFO, null);

        recorder.within(declaredContext("event-1"), () -> recorder.record(entry(AuditAction.TICKET_ARCHIVE), own));

        verify(auditEventMapper).toEvent(any(), any(), any(), any(), eq("event-1"), any());
    }

    @Test
    void record_contextWithItsOwnEventInsideADeclaredEvent_keepsItsOwnEvent() {
        storesEvent();
        AuditContext own = new AuditContext(AuditActor.system("invoice-sync"), REQUEST_INFO, "event-2");

        recorder.within(declaredContext("event-1"), () -> recorder.record(entry(AuditAction.TICKET_ARCHIVE), own));

        verify(auditEventMapper).toEvent(any(), any(), any(), any(), eq("event-2"), any());
    }

    @ParameterizedTest
    @MethodSource("people")
    void record_personActor_storesTheUsersName(AuditActor person) {
        storesEvent();
        when(userRepository.findById(person.id())).thenReturn(Optional.of(user("Anna", "Kowalski")));

        recorder.record(entry(AuditAction.TICKET_ARCHIVE), person);

        assertThat(savedEvent().getActorName()).isEqualTo("Anna Kowalski");
    }

    @Test
    void record_deviceActor_storesTheHostnameOfItsMachine() {
        storesEvent();
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine()));

        recorder.record(entry(AuditAction.DEVICE_REGISTER),
                AuditActor.fromAgent(MACHINE_ID, List.of("AGENT"), SERVED_TENANT_ID));

        assertThat(savedEvent().getActorName()).isEqualTo("LAPTOP-7F3A");
    }

    @Test
    void record_actorWithItsOwnName_storesItWithoutARead() {
        storesEvent();

        recorder.record(entry(AuditAction.TICKET_ARCHIVE), AuditActor.system("script-watchdog"));

        assertThat(savedEvent().getActorName()).isEqualTo("script-watchdog");
        verifyNoInteractions(userRepository, machineRepository);
    }

    @Test
    void record_actorWithoutId_readsNoName() {
        storesEvent();

        recorder.record(entry(AuditAction.AUTH_LOGIN_FAIL),
                AuditActor.fromUser(null, "unknown@acme.com", List.of(), null, SUPER_TENANT_ID));

        assertThat(savedEvent().getActorName()).isNull();
        verifyNoInteractions(userRepository);
    }

    @Test
    void record_apiKeyWithoutName_readsNoName() {
        storesEvent();

        recorder.record(entry(AuditAction.TICKET_ARCHIVE), AuditActor.fromApiKey("key-9", null, null, null, null));

        assertThat(savedEvent().getActorName()).isNull();
        verifyNoInteractions(userRepository, machineRepository);
    }

    @Test
    void record_userRecordGone_storesNoName() {
        storesEvent();
        when(userRepository.findById("staff-1")).thenReturn(Optional.empty());

        recorder.record(entry(AuditAction.TICKET_ARCHIVE), AuditActor.staff("staff-1"));

        assertThat(savedEvent().getActorName()).isNull();
    }

    @Test
    void record_actorNameReadFails_storesTheEventWithoutTheName() {
        storesEvent();
        when(userRepository.findById("staff-1")).thenThrow(new DataAccessResourceFailureException("mongo down"));

        recorder.record(entry(AuditAction.TICKET_ARCHIVE), AuditActor.staff("staff-1"));

        assertThat(savedEvent().getActorName()).isNull();
    }

    @Test
    void record_mingoActor_storesTheNameOfTheUserItActsFor() {
        storesEvent();
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user("Anna", "Kowalski")));

        recorder.record(entry(AuditAction.TICKET_ARCHIVE), AuditActor.mingo(USER_ID));

        assertThat(savedEvent().getOnBehalfOfName()).isEqualTo("Anna Kowalski");
    }

    @Test
    void record_faeActor_storesTheHostnameOfTheDeviceItActsFor() {
        storesEvent();
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine()));

        recorder.record(entry(AuditAction.TICKET_ARCHIVE), AuditActor.fae(MACHINE_ID));

        assertThat(savedEvent().getOnBehalfOfName()).isEqualTo("LAPTOP-7F3A");
    }

    @Test
    void record_actorWithApprover_storesTheApproversName() {
        storesEvent();
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user("Anna", "Kowalski")));
        when(userRepository.findById("user-2")).thenReturn(Optional.of(user("Ola", "Nowak")));
        AuditActor approver =
                AuditActor.fromUser("user-2", "ola@acme.com", List.of("ADMIN"), SERVED_TENANT_ID, SUPER_TENANT_ID);

        recorder.record(entry(AuditAction.TICKET_ARCHIVE), AuditActor.mingo(USER_ID).withApprover(approver));

        assertThat(savedEvent().getApproverName()).isEqualTo("Ola Nowak");
    }

    @Test
    void record_targetFieldsMissing_takesThemFromTheStoredTarget() {
        storesEvent();
        when(targetRepository.load(List.of(TICKET_TARGET), "ticket-1")).thenReturn(storedTicket("Printer offline"));

        recorder(targetsOf(TICKET_TARGET)).record(ticketArchive("ticket-1"));

        assertThat(mappedEntry())
                .extracting(AuditEntry::getTargetName, AuditEntry::getOrganizationId, AuditEntry::getDeviceId)
                .containsExactly("Printer offline", "org-7", "device-7");
    }

    @Test
    void record_targetNameAndCustomerGiven_keepsThemOverTheStoredOnes() {
        storesEvent();
        when(targetRepository.load(List.of(TICKET_TARGET), "ticket-1")).thenReturn(storedTicket("Printer offline"));

        recorder(targetsOf(TICKET_TARGET)).record(ticketArchive("ticket-1").toBuilder()
                .targetName("Printer offline at the time")
                .organizationId("org-1")
                .build());

        assertThat(mappedEntry())
                .extracting(AuditEntry::getTargetName, AuditEntry::getOrganizationId, AuditEntry::getDeviceId)
                .containsExactly("Printer offline at the time", "org-1", "device-7");
    }

    @Test
    void record_targetNameCustomerAndDeviceGiven_readsNoTarget() {
        storesEvent();

        recorder(targetsOf(TICKET_TARGET)).record(ticketArchive("ticket-1").toBuilder()
                .targetName("Printer offline")
                .organizationId("org-1")
                .deviceId("device-1")
                .build());

        assertThat(mappedEntry().getTargetName()).isEqualTo("Printer offline");
        verifyNoInteractions(targetRepository);
    }

    @Test
    void record_targetNotStored_passesTheEntryOnWithoutItsName() {
        storesEvent();
        when(targetRepository.load(List.of(TICKET_TARGET), "ticket-1")).thenReturn(Optional.empty());

        recorder(targetsOf(TICKET_TARGET)).record(ticketArchive("ticket-1"));

        assertThat(mappedEntry()).extracting(AuditEntry::getTargetId, AuditEntry::getTargetName)
                .containsExactly("ticket-1", null);
    }

    @Test
    void record_targetReadFails_passesTheEntryOnWithoutItsName() {
        storesEvent();
        when(targetRepository.load(List.of(TICKET_TARGET), "ticket-1"))
                .thenThrow(new DataAccessResourceFailureException("mongo down"));

        recorder(targetsOf(TICKET_TARGET)).record(ticketArchive("ticket-1"));

        assertThat(mappedEntry()).extracting(AuditEntry::getTargetId, AuditEntry::getTargetName)
                .containsExactly("ticket-1", null);
    }

    @Test
    void record_targetWithoutIdNotKeyedByTenant_passesItOnWithoutIdAndReadsNothing() {
        storesEvent();

        recorder(targetsOf(TICKET_TARGET)).record(entry(AuditAction.TICKET_ARCHIVE));

        assertThat(mappedEntry().getTargetId()).isNull();
        verify(tenantResolver, never()).isolatedTenantId();
        verifyNoInteractions(targetRepository);
    }

    @Test
    void record_targetKeyedByTenantWithoutId_readsItByTheServedTenant() {
        storesEvent();
        AuditTarget<SSOPerTenantConfig> ssoTarget = AuditTarget.of(AuditTargetType.SSO_CONFIG,
                SSOPerTenantConfig.class, SSOPerTenantConfig::getProvider).withIdField(AuditTarget.TENANT_ID_FIELD);
        SSOPerTenantConfig config = new SSOPerTenantConfig();
        config.setProvider("google");
        when(tenantResolver.isolatedTenantId()).thenReturn(SERVED_TENANT_ID);
        when(targetRepository.load(List.of(ssoTarget), SERVED_TENANT_ID))
                .thenReturn(Optional.of(new LoadedTarget(ssoTarget, config)));

        recorder(targetsOf(ssoTarget)).record(entry(AuditAction.SSO_CONFIG_TOGGLE));

        assertThat(mappedEntry()).extracting(AuditEntry::getTargetId, AuditEntry::getTargetName)
                .containsExactly(SERVED_TENANT_ID, "google");
    }

    @Test
    void record_secretTargetId_passesOnItsHash() {
        storesEvent();

        recorder(targetsOf(invitationTarget())).record(entry(AuditAction.INVITATION_REVOKE).toBuilder()
                .targetId("abc")
                .targetName("new@acme.com")
                .build());

        assertThat(mappedEntry().getTargetId())
                .isEqualTo("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    }

    @Test
    void record_secretTargetWithoutId_passesItOnWithoutId() {
        storesEvent();

        recorder(targetsOf(invitationTarget())).record(entry(AuditAction.INVITATION_REVOKE));

        assertThat(mappedEntry().getTargetId()).isNull();
    }

    @Test
    void targetIdOf_tenantWithoutId_isTheServedTenant() {
        when(tenantResolver.isolatedTenantId()).thenReturn(SERVED_TENANT_ID);

        assertThat(recorder.targetIdOf(AuditTargetType.TENANT, null)).isEqualTo(SERVED_TENANT_ID);
    }

    @Test
    void recordCaptured_targetWithLoader_passesTheEntryOnUnread() {
        storesEvent();

        recorder(targetsOf(TICKET_TARGET)).recordCaptured(ticketArchive("ticket-1"), declaredContext(null));

        assertThat(mappedEntry().getTargetId()).isEqualTo("ticket-1");
        verifyNoInteractions(targetRepository);
    }

    @Test
    void recordCaptured_eventStored_returnsItsId() {
        storesEvent();

        String eventId = recorder.recordCaptured(ticketArchive("ticket-1"), declaredContext(null));

        assertThat(eventId).isEqualTo("event-1");
    }

    @Test
    void within_runnableWork_runsUnderTheDeclaredContext() {
        AuditContext declared = declaredContext("event-1");

        recorder.within(declared, () -> {
            seenInside = recorder.context();
        });

        assertThat(seenInside).isEqualTo(declared);
    }

    @Test
    void within_contextWithoutEventInsideADeclaredEvent_hangsUnderIt() {
        AuditContext inner = new AuditContext(AuditActor.system("invoice-sync"), REQUEST_INFO, null);

        AuditContext context = recorder.within(declaredContext("event-1"),
                () -> recorder.within(inner, () -> recorder.context()));

        assertThat(context.currentEventId()).isEqualTo("event-1");
    }

    @Test
    void within_innerContextEnds_restoresTheOuterOne() {
        AuditContext outer = declaredContext("event-1");

        AuditContext context = recorder.within(outer, () -> {
            recorder.within(new AuditContext(AuditActor.system("invoice-sync"), REQUEST_INFO, "event-2"), () -> {
            });
            return recorder.context();
        });

        assertThat(context).isEqualTo(outer);
    }

    @Test
    void within_workThrows_leavesNoContextBehind() {
        assertThatThrownBy(() -> recorder.within(declaredContext("event-1"), () -> {
            throw new IllegalStateException("job failed");
        })).isInstanceOf(IllegalStateException.class).hasMessage("job failed");

        assertThat(recorder.currentEventId()).isNull();
    }

    @Test
    void capturing_work_runsUnderTheDeclaredContextAndReturnsItsResult() {
        AuditContext declared = declaredContext("event-1");

        AuditContext context = recorder.capturing(declared, recorder::context);

        assertThat(context).isEqualTo(declared);
    }

    @Test
    void capturing_innerCaptureEnds_outerStillSkipsRecordsUnlessCaptured() {
        recorder.capturing(null, () -> {
            recorder.capturing(null, () -> null);
            recorder.recordUnlessCaptured(denial());
            return null;
        });

        verifyNoInteractions(auditEventMapper);
    }

    @Test
    void capturing_captureEnded_recordsUnlessCapturedAgain() {
        AuditEvent event = storesEvent();
        recorder.capturing(null, () -> null);

        recorder.recordUnlessCaptured(denial());

        verify(auditEventRepository).insert(event);
    }

    @Test
    void capturing_workThrows_recordsUnlessCapturedAgainAfterwards() {
        AuditEvent event = storesEvent();
        assertThatThrownBy(() -> recorder.capturing(null, () -> {
            throw new IllegalStateException("Ticket is archived");
        })).isInstanceOf(IllegalStateException.class).hasMessage("Ticket is archived");

        recorder.recordUnlessCaptured(denial());

        verify(auditEventRepository).insert(event);
    }

    @Test
    void inCurrentContext_runOutsideTheContext_runsUnderTheCallersContext() {
        AuditContext declared = declaredContext("event-1");
        Supplier<AuditContext> later = recorder.within(declared, () -> recorder.inCurrentContext(recorder::context));

        assertThat(later.get()).isEqualTo(declared);
    }

    @ParameterizedTest
    @MethodSource("failuresOfACapture")
    void captured_failureACaptureMarkedOrItsWrapper_isTrue(Throwable failure) {
        recorder.markCaptured(CAPTURED_FAILURE);

        assertThat(recorder.captured(failure)).isTrue();
    }

    @Test
    void captured_unmarkedFailure_isFalse() {
        assertThat(recorder.captured(new IllegalStateException("another"))).isFalse();
    }

    @Test
    void recordUnlessCaptured_insideACapture_recordsNothing() {
        recorder.capturing(null, () -> {
            recorder.recordUnlessCaptured(denial());
            return null;
        });

        verifyNoInteractions(auditEventMapper);
    }

    @Test
    void recordUnlessCaptured_outsideACapture_recordsTheEntry() {
        AuditEvent event = storesEvent();

        recorder.recordUnlessCaptured(denial());

        verify(auditEventRepository).insert(event);
    }

    @Test
    void recordOnce_sameKeyTwice_recordsOnce() {
        AuditEvent event = storesEvent();

        recorder.recordOnce(denial(), ENDPOINT);
        recorder.recordOnce(denial(), ENDPOINT);

        verify(auditEventRepository).insert(event);
    }

    @Test
    void recordOnce_otherKey_recordsItToo() {
        AuditEvent event = storesEvent();

        recorder.recordOnce(denial(), ENDPOINT);
        recorder.recordOnce(denial(), "GET /api/devices");

        verify(auditEventRepository, times(2)).insert(event);
    }

    @Test
    void recordOnce_sameKeyForAnotherActor_recordsItToo() {
        AuditEvent event = storesEvent();

        recorder.recordOnce(denial(), ENDPOINT, AuditActor.system("invoice-sync"));
        recorder.recordOnce(denial(), ENDPOINT, AuditActor.system("script-watchdog"));

        verify(auditEventRepository, times(2)).insert(event);
    }

    @Test
    void recordOnce_sameKeyInAnotherTenant_recordsItToo() {
        AuditEvent event = storesEvent();
        when(tenantResolver.tenantFor(AuditActor.system(), "tenant-1")).thenReturn("tenant-1");
        when(tenantResolver.tenantFor(AuditActor.system(), "tenant-2")).thenReturn("tenant-2");

        recorder.recordOnce(denial().toBuilder().tenantId("tenant-1").build(), ENDPOINT);
        recorder.recordOnce(denial().toBuilder().tenantId("tenant-2").build(), ENDPOINT);

        verify(auditEventRepository, times(2)).insert(event);
    }

    @Test
    void recordOnce_callerCannotBeRead_logsAndRecordsNothing() {
        currentRequest().addHeader(X_API_KEY_ID, "key-1");
        when(apiKeyRepository.findById("key-1"))
                .thenThrow(new IllegalArgumentException("No enum constant ApiKeyStatus.PAUSED"));

        recorder.recordOnce(denial(), ENDPOINT);

        assertThat(appender.list).extracting(ILoggingEvent::getFormattedMessage)
                .containsExactly("Audit event not recorded for auth.access.refuse");
        verifyNoInteractions(auditEventMapper);
    }

    @Test
    void recordOnceUnlessCaptured_insideACapture_recordsNothing() {
        recorder.capturing(null, () -> {
            recorder.recordOnceUnlessCaptured(denial(), ENDPOINT);
            return null;
        });

        verifyNoInteractions(auditEventMapper);
    }

    @Test
    void recordOnceUnlessCaptured_outsideACapture_recordsTheEntry() {
        AuditEvent event = storesEvent();

        recorder.recordOnceUnlessCaptured(denial(), ENDPOINT);

        verify(auditEventRepository).insert(event);
    }

    @Test
    void recordFailure_exception_recordsTheOutcomeAndReasonOfTheResolver() {
        storesEvent();
        IllegalArgumentException failure = new IllegalArgumentException("Ticket is archived");
        when(outcomeResolver.ofFailure(failure))
                .thenReturn(new ActionOutcome(AuditOutcome.REFUSED, "Refused: archived"));

        recorder.recordFailure(AuditEntry.builder().action(AuditAction.TICKET_ARCHIVE), failure);

        assertThat(mappedEntry()).extracting(AuditEntry::getOutcome, AuditEntry::getReason)
                .containsExactly(AuditOutcome.REFUSED, "Refused: archived");
    }

    @Test
    void recordUnresolvedFailure_exception_recordsTheOutcomeAndReasonOfTheResolver() {
        storesEvent();
        RuntimeException failure = new RuntimeException("Stripe did not answer");
        when(outcomeResolver.ofFailure(failure))
                .thenReturn(new ActionOutcome(AuditOutcome.FAILURE, "RuntimeException"));

        recorder.recordUnresolvedFailure(AuditEntry.builder().action(AuditAction.TICKET_ARCHIVE), failure, "invoice-1");

        assertThat(mappedEntry()).extracting(AuditEntry::getOutcome, AuditEntry::getReason)
                .containsExactly(AuditOutcome.FAILURE, "RuntimeException");
    }

    @Test
    void recordUnresolvedFailure_sameConditionTwice_recordsOnce() {
        AuditEvent event = storesEvent();

        recorder.recordUnresolvedFailure(failure(), "invoice-1");
        recorder.recordUnresolvedFailure(failure(), "invoice-1");

        verify(auditEventRepository).insert(event);
    }

    @Test
    void recordUnresolvedFailure_conditionResolved_recordsItAgain() {
        AuditEvent event = storesEvent();

        recorder.recordUnresolvedFailure(failure(), "invoice-1");
        recorder.failureResolved(AuditAction.TICKET_ARCHIVE, "invoice-1");
        recorder.recordUnresolvedFailure(failure(), "invoice-1");

        verify(auditEventRepository, times(2)).insert(event);
    }

    @Test
    void recordUnresolvedFailure_otherCondition_recordsItToo() {
        AuditEvent event = storesEvent();

        recorder.recordUnresolvedFailure(failure(), "invoice-1");
        recorder.recordUnresolvedFailure(failure(), "invoice-2");

        verify(auditEventRepository, times(2)).insert(event);
    }

    @Test
    void recordUnresolvedFailure_firstEventNotStored_recordsItAgainOnce() {
        AuditEvent event = mapsTo(AuditEvent.builder().id("event-1").build());
        when(auditEventRepository.insert(event))
                .thenThrow(new DataAccessResourceFailureException("mongo down"))
                .thenReturn(event);

        recorder.recordUnresolvedFailure(failure(), "invoice-1");
        recorder.recordUnresolvedFailure(failure(), "invoice-1");
        recorder.recordUnresolvedFailure(failure(), "invoice-1");

        verify(auditEventRepository, times(2)).insert(event);
    }

    @Test
    void recordAll_entries_storesTheirEventsInOneInsert() {
        AuditEvent first = new AuditEvent();
        AuditEvent second = new AuditEvent();
        when(auditEventMapper.toEvent(any(), any(), any(), any(), any(), any())).thenReturn(first, second);

        recorder.recordAll(List.of(entry(AuditAction.TICKET_ARCHIVE), entry(AuditAction.TICKET_ARCHIVE)));

        verify(auditEventRepository).insert(List.of(first, second));
    }

    @Test
    void recordAll_entriesWithoutTargetNames_takesThemFromTheStoredTargets() {
        when(auditEventMapper.toEvent(any(), any(), any(), any(), any(), any())).thenAnswer(_ -> new AuditEvent());
        when(targetRepository.load(List.of(TICKET_TARGET), "ticket-1")).thenReturn(storedTicket("Printer offline"));
        when(targetRepository.load(List.of(TICKET_TARGET), "ticket-2")).thenReturn(storedTicket("VPN down"));

        recorder(targetsOf(TICKET_TARGET)).recordAll(List.of(ticketArchive("ticket-1"), ticketArchive("ticket-2")));

        verify(auditEventMapper, times(2)).toEvent(entryCaptor.capture(), any(), any(), any(), any(), any());
        assertThat(entryCaptor.getAllValues()).extracting(AuditEntry::getTargetName)
                .containsExactly("Printer offline", "VPN down");
    }

    @Test
    void recordAll_entries_readsTheActorsNameOnce() {
        AuditEvent first = new AuditEvent();
        AuditEvent second = new AuditEvent();
        when(auditEventMapper.toEvent(any(), any(), any(), any(), any(), any())).thenReturn(first, second);
        when(userRepository.findById("staff-1")).thenReturn(Optional.of(user("John", null)));

        recorder.within(new AuditContext(AuditActor.staff("staff-1"), REQUEST_INFO, null), () -> recorder.recordAll(
                List.of(entry(AuditAction.TICKET_ARCHIVE), entry(AuditAction.TICKET_ARCHIVE))));

        assertThat(List.of(first, second)).extracting(AuditEvent::getActorName).containsExactly("John", "John");
        verify(userRepository).findById("staff-1");
    }

    @Test
    void recordAll_entryWithoutTargetTypeAmongOthers_skipsItWithAnErrorLogAndStoresTheOthers() {
        AuditEvent event = new AuditEvent();
        when(auditEventMapper.toEvent(any(), any(), any(), any(), any(), any())).thenReturn(event);

        recorder.recordAll(List.of(entry(AuditAction.LINK_CREATE), entry(AuditAction.TICKET_ARCHIVE)));

        verify(auditEventRepository).insert(List.of(event));
        assertThat(appender.list).extracting(ILoggingEvent::getFormattedMessage)
                .containsExactly("Audit skipped: link.create has no fixed target type, so the entry must name one");
    }

    @Test
    void recordAll_onlyEntriesWithoutTargetType_storesNothing() {
        recorder.recordAll(List.of(entry(AuditAction.LINK_CREATE)));

        verifyNoInteractions(auditEventMapper, auditEventRepository);
    }

    @Test
    void recordAll_failureBeforeTheEventsAreBuilt_logsTheEntries() {
        when(userRepository.findById("staff-1"))
                .thenThrow(new IllegalArgumentException("No enum constant UserStatus.ARCHIVED"));

        recorder.within(new AuditContext(AuditActor.staff("staff-1"), REQUEST_INFO, null),
                () -> recorder.recordAll(List.of(ticketArchive("ticket-1"))));

        assertThat(appender.list).extracting(ILoggingEvent::getFormattedMessage).singleElement().asString()
                .startsWith("Audit events not recorded: [AuditEntry(")
                .contains("action=TICKET_ARCHIVE", "targetId=ticket-1");
    }

    @Test
    void recordAll_auditOff_recordsNothing() {
        recorder(new AuditTargetRegistry(List.of()), false).recordAll(List.of(entry(AuditAction.TICKET_ARCHIVE)));

        verifyNoInteractions(auditEventMapper, auditEventRepository);
    }

    @ParameterizedTest
    @MethodSource("incompleteEntries")
    void recordAll_incompleteEntryAmongOthers_throws(AuditEntry incomplete, String message) {
        List<AuditEntry> entries = List.of(entry(AuditAction.TICKET_ARCHIVE), incomplete);

        assertThatThrownBy(() -> recorder.recordAll(entries))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage(message);
    }

    @Test
    void recordAll_insertFails_logsEveryEventAsJson() {
        AuditEvent first = AuditEvent.builder().id("event-1").build();
        AuditEvent second = AuditEvent.builder().id("event-2").build();
        when(auditEventMapper.toEvent(any(), any(), any(), any(), any(), any())).thenReturn(first, second);
        when(auditEventRepository.insert(List.of(first, second)))
                .thenThrow(new DataAccessResourceFailureException("mongo down"));

        recorder.recordAll(List.of(entry(AuditAction.TICKET_ARCHIVE), entry(AuditAction.TICKET_ARCHIVE)));

        assertThat(appender.list).singleElement().satisfies(logged -> {
            assertThat(logged.getLevel()).isEqualTo(Level.ERROR);
            assertThat(logged.getFormattedMessage())
                    .startsWith("Audit events not recorded: [{")
                    .contains("\"id\":\"event-1\"", "\"id\":\"event-2\"");
            assertThat(logged.getThrowableProxy().getClassName())
                    .isEqualTo(DataAccessResourceFailureException.class.getName());
        });
    }

    @Test
    void currentEndpoint_request_isItsMethodAndPath() {
        MockHttpServletRequest request = currentRequest();
        request.setMethod("GET");
        request.setRequestURI("/api/users");

        assertThat(recorder.currentEndpoint()).isEqualTo("GET /api/users");
    }

    @Test
    void currentEndpoint_noRequest_isEmpty() {
        assertThat(recorder.currentEndpoint()).isNull();
    }

    static Stream<Arguments> incompleteEntries() {
        return Stream.of(
                Arguments.of(AuditEntry.builder().outcome(AuditOutcome.SUCCESS).build(),
                        "An audit entry needs an action"),
                Arguments.of(AuditEntry.builder().action(AuditAction.TICKET_ARCHIVE).build(),
                        "An audit entry needs an outcome"));
    }

    static Stream<AuditActor> people() {
        return Stream.of(
                AuditActor.fromUser(USER_ID, "anna@acme.com", List.of("ADMIN"), SERVED_TENANT_ID, SUPER_TENANT_ID),
                AuditActor.staff("staff-1"));
    }

    static Stream<Throwable> failuresOfACapture() {
        return Stream.of(CAPTURED_FAILURE, new RuntimeException(CAPTURED_FAILURE));
    }

    private AuditRecorder recorder(AuditTargetRegistry targets) {
        return recorder(targets, true);
    }

    private AuditRecorder recorder(AuditTargetRegistry targets, boolean enabled) {
        return new AuditRecorder(auditEventRepository, userRepository, machineRepository, apiKeyRepository,
                targetRepository, tenantResolver, targets, outcomeResolver, auditEventMapper, new ObjectMapper(),
                auditClock, enabled);
    }

    private static AuditTargetRegistry targetsOf(AuditTarget<?> target) {
        return new AuditTargetRegistry(List.of(() -> List.of(target)));
    }

    private static AuditTarget<Invitation> invitationTarget() {
        return AuditTarget.of(AuditTargetType.INVITATION, Invitation.class, Invitation::getEmail).withSecretId(true);
    }

    private AuditEvent mapsTo(AuditEvent event) {
        when(auditEventMapper.toEvent(any(), any(), any(), any(), any(), any())).thenReturn(event);
        return event;
    }

    private AuditEvent storesEvent() {
        AuditEvent event = mapsTo(AuditEvent.builder().id("event-1").build());
        when(auditEventRepository.insert(event)).thenReturn(event);
        return event;
    }

    private AuditEntry mappedEntry() {
        verify(auditEventMapper).toEvent(entryCaptor.capture(), any(), any(), any(), any(), any());
        return entryCaptor.getValue();
    }

    private AuditEvent savedEvent() {
        verify(auditEventRepository).insert(eventCaptor.capture());
        return eventCaptor.getValue();
    }

    private static AuditContext declaredContext(String currentEventId) {
        return new AuditContext(AuditActor.system("script-watchdog"), REQUEST_INFO, currentEventId);
    }

    private static AuditEntry entry(AuditAction action) {
        return AuditEntry.builder().action(action).outcome(AuditOutcome.SUCCESS).build();
    }

    private static AuditEntry ticketArchive(String ticketId) {
        return entry(AuditAction.TICKET_ARCHIVE).toBuilder().targetId(ticketId).build();
    }

    private static AuditEntry denial() {
        return AuditEntry.builder().action(AuditAction.AUTH_ACCESS_REFUSE).outcome(AuditOutcome.REFUSED).build();
    }

    private static AuditEntry failure() {
        return AuditEntry.builder().action(AuditAction.TICKET_ARCHIVE).outcome(AuditOutcome.FAILURE).build();
    }

    private static Optional<LoadedTarget> storedTicket(String title) {
        Ticket ticket = new Ticket();
        ticket.setTitle(title);
        ticket.setOrganizationId("org-7");
        ticket.setDeviceId("device-7");
        return Optional.of(new LoadedTarget(TICKET_TARGET, ticket));
    }

    private static User user(String firstName, String lastName) {
        User user = new User();
        user.setFirstName(firstName);
        user.setLastName(lastName);
        return user;
    }

    private static Machine machine() {
        Machine machine = new Machine();
        machine.setHostname("LAPTOP-7F3A");
        return machine;
    }

    private static MockHttpServletRequest currentRequest() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
        return request;
    }

    private static void signIn(String subject, String tenantId, Map<String, Object> claims) {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "none")
                .subject(subject)
                .claim("tenant_id", tenantId)
                .claims(all -> all.putAll(claims))
                .build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt));
    }
}
