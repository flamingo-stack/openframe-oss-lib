package com.openframe.audit;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.openframe.audit.targets.AuditTarget;
import com.openframe.audit.targets.AuditTargetRegistry;
import com.openframe.audit.targets.AuditTargetRepository;
import com.openframe.audit.targets.LoadedTarget;
import com.openframe.data.document.audit.AuditAction;
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
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessResourceFailureException;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuditEventWriterTest {

    private static final String SUPER_TENANT_ID = "super-tenant";
    private static final String SERVED_TENANT_ID = "tenant-1";
    private static final String USER_ID = "user-1";
    private static final String MACHINE_ID = "machine-1";
    private static final Instant OCCURRED_AT = Instant.parse("2026-10-28T14:12:00Z");
    private static final AuditRequestInfo REQUEST_INFO =
            new AuditRequestInfo("203.0.113.5", "Mingo", "request-7", "session-7");
    private static final AuditContext JOB_CONTEXT =
            new AuditContext(AuditActor.system("script-watchdog"), REQUEST_INFO, null);
    private static final AuditTarget<Ticket> TICKET_TARGET =
            AuditTarget.of(AuditTargetType.TICKET, Ticket.class, Ticket::getTitle)
                    .withOrganizationId(Ticket::getOrganizationId)
                    .withDeviceId(Ticket::getDeviceId);

    @Mock private AuditEventRepository auditEventRepository;
    @Mock private UserRepository userRepository;
    @Mock private MachineRepository machineRepository;
    @Mock private AuditTargetRepository targetRepository;
    @Mock private AuditTenantResolver tenantResolver;
    @Mock private AuditEventMapper auditEventMapper;
    @Mock private AuditClock auditClock;
    @Captor private ArgumentCaptor<List<AuditEvent>> eventsCaptor;
    @Captor private ArgumentCaptor<AuditEntry> entryCaptor;

    private final Logger logger = (Logger) LoggerFactory.getLogger(AuditEventWriter.class);
    private final ListAppender<ILoggingEvent> appender = new ListAppender<>();

    private AuditEventWriter writer;

    @BeforeEach
    void setUp() {
        writer = writer(new AuditTargetRegistry(List.of()));
        appender.start();
        logger.addAppender(appender);
    }

    @AfterEach
    void detachAppender() {
        logger.detachAppender(appender);
    }

    @Test
    void write_entryInContext_storesTheEventBuiltFromTheContextTheResolvedTenantAndTheClock() {
        AuditActor job = AuditActor.system("invoice-sync");
        when(tenantResolver.tenantFor(job, "tenant-2")).thenReturn("tenant-7");
        when(auditClock.now()).thenReturn(OCCURRED_AT);
        AuditEvent event = mapsToAnEvent();

        writer.write(List.of(entry(AuditAction.TICKET_ARCHIVE).toBuilder().tenantId("tenant-2").build()),
                new AuditContext(job, REQUEST_INFO, "event-0"), true);

        verify(auditEventMapper).toEvent(any(), eq(job), eq(REQUEST_INFO), eq("tenant-7"), eq("event-0"),
                eq(OCCURRED_AT));
        verify(auditEventRepository).insert(List.of(event));
    }

    @Test
    void write_entryWithoutTargetType_passesItsFieldsOnWithTheActionsTargetType() {
        mapsToAnEvent();

        writer.write(List.of(AuditEntry.builder()
                .action(AuditAction.TICKET_ARCHIVE)
                .outcome(AuditOutcome.REFUSED)
                .reason("Ticket is archived")
                .targetId("ticket-1")
                .targetName("Printer offline")
                .organizationId("org-1")
                .deviceId("device-1")
                .details(Map.of("statusKind", "RESOLVED"))
                .changes(Map.of("status", new AuditChange("OPEN", "ARCHIVED")))
                .build()), JOB_CONTEXT, true);

        assertThat(mappedEntry())
                .extracting(AuditEntry::targetTypeOrDefault, AuditEntry::getOutcome, AuditEntry::getReason,
                        AuditEntry::getTargetId, AuditEntry::getTargetName, AuditEntry::getOrganizationId,
                        AuditEntry::getDeviceId, AuditEntry::getDetails, AuditEntry::getChanges)
                .containsExactly(AuditTargetType.TICKET, AuditOutcome.REFUSED, "Ticket is archived", "ticket-1",
                        "Printer offline", "org-1", "device-1", Map.of("statusKind", "RESOLVED"),
                        Map.of("status", new AuditChange("OPEN", "ARCHIVED")));
    }

    @Test
    void write_actionOfSeveralTargetKindsWithTheKindNamed_passesItOnWithTheNamedType() {
        mapsToAnEvent();

        writer.write(List.of(entry(AuditAction.LINK_CREATE).toBuilder().targetType(AuditTargetType.KB_ARTICLE).build()),
                JOB_CONTEXT, true);

        assertThat(mappedEntry().getTargetType()).isEqualTo(AuditTargetType.KB_ARTICLE);
    }

    @Test
    void write_eventsStored_returnsTrue() {
        mapsToAnEvent();

        boolean stored = writer.write(List.of(entry(AuditAction.TICKET_ARCHIVE)), JOB_CONTEXT, true);

        assertThat(stored).isTrue();
    }

    @Test
    void write_severalEntries_storesTheirEventsInOneInsert() {
        AuditEvent first = AuditEvent.builder().id("event-1").build();
        AuditEvent second = AuditEvent.builder().id("event-2").build();
        when(auditEventMapper.toEvent(any(), any(), any(), any(), any(), any())).thenReturn(first, second);

        writer.write(List.of(entry(AuditAction.TICKET_ARCHIVE), entry(AuditAction.TICKET_ARCHIVE)), JOB_CONTEXT, true);

        verify(auditEventRepository).insert(List.of(first, second));
    }

    @Test
    void write_severalEntries_readsTheActorsNameOnce() {
        AuditEvent first = AuditEvent.builder().id("event-1").build();
        AuditEvent second = AuditEvent.builder().id("event-2").build();
        when(auditEventMapper.toEvent(any(), any(), any(), any(), any(), any())).thenReturn(first, second);
        when(userRepository.findById("staff-1")).thenReturn(Optional.of(user("John", null)));

        writer.write(List.of(entry(AuditAction.TICKET_ARCHIVE), entry(AuditAction.TICKET_ARCHIVE)),
                contextOf(AuditActor.staff("staff-1")), true);

        assertThat(savedEvents()).extracting(AuditEvent::getActorName).containsExactly("John", "John");
        verify(userRepository).findById("staff-1");
    }

    @Test
    void write_insertFails_logsEveryEventAsJsonAndReturnsFalse() {
        AuditEvent first = AuditEvent.builder().id("event-1").action("ticket.archive").build();
        AuditEvent second = AuditEvent.builder().id("event-2").build();
        when(auditEventMapper.toEvent(any(), any(), any(), any(), any(), any())).thenReturn(first, second);
        when(auditEventRepository.insert(List.of(first, second)))
                .thenThrow(new DataAccessResourceFailureException("mongo down"));

        boolean stored = writer.write(
                List.of(entry(AuditAction.TICKET_ARCHIVE), entry(AuditAction.TICKET_ARCHIVE)), JOB_CONTEXT, true);

        assertThat(stored).isFalse();
        assertThat(appender.list).singleElement().satisfies(logged -> {
            assertThat(logged.getLevel()).isEqualTo(Level.ERROR);
            assertThat(logged.getFormattedMessage())
                    .startsWith("Audit events not stored: [{")
                    .contains("\"id\":\"event-1\"", "\"action\":\"ticket.archive\"", "\"id\":\"event-2\"");
            assertThat(logged.getThrowableProxy().getClassName())
                    .isEqualTo(DataAccessResourceFailureException.class.getName());
        });
    }

    @Test
    void write_insertFailsForAnEventJsonCannotWrite_logsTheEventAsText() {
        Map<String, Object> cyclicDetails = new HashMap<>();
        cyclicDetails.put("result", cyclicDetails);
        AuditEvent event = mapsTo(AuditEvent.builder().id("event-1").details(cyclicDetails).build());
        when(auditEventRepository.insert(List.of(event))).thenThrow(new DataAccessResourceFailureException("mongo down"));

        writer.write(List.of(entry(AuditAction.TICKET_ARCHIVE)), JOB_CONTEXT, true);

        assertThat(appender.list).extracting(ILoggingEvent::getFormattedMessage).singleElement().asString()
                .startsWith("Audit events not stored: [AuditEvent(id=event-1,");
    }

    @ParameterizedTest
    @MethodSource("people")
    void write_personActor_storesTheUsersName(AuditActor person) {
        mapsToAnEvent();
        when(userRepository.findById(person.id())).thenReturn(Optional.of(user("Anna", "Kowalski")));

        writer.write(List.of(entry(AuditAction.TICKET_ARCHIVE)), contextOf(person), true);

        assertThat(savedEvents()).extracting(AuditEvent::getActorName).containsExactly("Anna Kowalski");
    }

    @Test
    void write_deviceActor_storesTheNameOfItsMachine() {
        mapsToAnEvent();
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine()));

        writer.write(List.of(entry(AuditAction.DEVICE_REGISTER)),
                contextOf(AuditActor.fromAgent(MACHINE_ID, List.of("AGENT"), SERVED_TENANT_ID)), true);

        assertThat(savedEvents()).extracting(AuditEvent::getActorName).containsExactly("LAPTOP-7F3A");
    }

    @Test
    void write_actorWithItsOwnName_storesItWithoutARead() {
        mapsToAnEvent();

        writer.write(List.of(entry(AuditAction.TICKET_ARCHIVE)), contextOf(AuditActor.system("script-watchdog")), true);

        assertThat(savedEvents()).extracting(AuditEvent::getActorName).containsExactly("script-watchdog");
        verifyNoInteractions(userRepository, machineRepository);
    }

    @Test
    void write_actorWithoutId_readsNoName() {
        mapsToAnEvent();

        writer.write(List.of(entry(AuditAction.AUTH_LOGIN_FAIL)),
                contextOf(AuditActor.fromUser(null, "unknown@acme.com", List.of(), null, SUPER_TENANT_ID)), true);

        assertThat(savedEvents()).extracting(AuditEvent::getActorName).containsOnlyNulls();
        verifyNoInteractions(userRepository);
    }

    @Test
    void write_apiKeyWithoutName_readsNoName() {
        mapsToAnEvent();

        writer.write(List.of(entry(AuditAction.TICKET_ARCHIVE)),
                contextOf(AuditActor.fromApiKey("key-9", null, null, null, null)), true);

        assertThat(savedEvents()).extracting(AuditEvent::getActorName).containsOnlyNulls();
        verifyNoInteractions(userRepository, machineRepository);
    }

    @Test
    void write_userRecordGone_storesNoName() {
        mapsToAnEvent();
        when(userRepository.findById("staff-1")).thenReturn(Optional.empty());

        writer.write(List.of(entry(AuditAction.TICKET_ARCHIVE)), contextOf(AuditActor.staff("staff-1")), true);

        assertThat(savedEvents()).extracting(AuditEvent::getActorName).containsOnlyNulls();
    }

    @Test
    void write_actorNameReadFails_storesTheEventWithoutTheName() {
        mapsToAnEvent();
        when(userRepository.findById("staff-1")).thenThrow(new DataAccessResourceFailureException("mongo down"));

        writer.write(List.of(entry(AuditAction.TICKET_ARCHIVE)), contextOf(AuditActor.staff("staff-1")), true);

        assertThat(savedEvents()).extracting(AuditEvent::getActorName).containsOnlyNulls();
    }

    @Test
    void write_mingoActor_storesTheNameOfTheUserItActsFor() {
        mapsToAnEvent();
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user("Anna", "Kowalski")));

        writer.write(List.of(entry(AuditAction.TICKET_ARCHIVE)), contextOf(AuditActor.mingo(USER_ID)), true);

        assertThat(savedEvents()).extracting(AuditEvent::getOnBehalfOfName).containsExactly("Anna Kowalski");
    }

    @Test
    void write_faeActor_storesTheNameOfTheDeviceItActsFor() {
        mapsToAnEvent();
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine()));

        writer.write(List.of(entry(AuditAction.TICKET_ARCHIVE)), contextOf(AuditActor.fae(MACHINE_ID)), true);

        assertThat(savedEvents()).extracting(AuditEvent::getOnBehalfOfName).containsExactly("LAPTOP-7F3A");
    }

    @Test
    void write_actorWithApprover_storesTheApproversName() {
        mapsToAnEvent();
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user("Anna", "Kowalski")));
        when(userRepository.findById("user-2")).thenReturn(Optional.of(user("Ola", "Nowak")));
        AuditActor approver =
                AuditActor.fromUser("user-2", "ola@acme.com", List.of("ADMIN"), SERVED_TENANT_ID, SUPER_TENANT_ID);

        writer.write(List.of(entry(AuditAction.TICKET_ARCHIVE)),
                contextOf(AuditActor.mingo(USER_ID).withApprover(approver)), true);

        assertThat(savedEvents()).extracting(AuditEvent::getApproverName).containsExactly("Ola Nowak");
    }

    @Test
    void write_targetFieldsMissing_takesThemFromTheStoredTarget() {
        mapsToAnEvent();
        when(targetRepository.load(List.of(TICKET_TARGET), "ticket-1")).thenReturn(storedTicket());

        writer(targetsOf(TICKET_TARGET)).write(List.of(ticketArchive()), JOB_CONTEXT, true);

        assertThat(mappedEntry())
                .extracting(AuditEntry::getTargetName, AuditEntry::getOrganizationId, AuditEntry::getDeviceId)
                .containsExactly("Printer offline", "org-7", "device-7");
    }

    @Test
    void write_targetNameAndCustomerGiven_keepsThemOverTheStoredOnes() {
        mapsToAnEvent();
        when(targetRepository.load(List.of(TICKET_TARGET), "ticket-1")).thenReturn(storedTicket());

        writer(targetsOf(TICKET_TARGET)).write(List.of(ticketArchive().toBuilder()
                .targetName("Printer offline at the time")
                .organizationId("org-1")
                .build()), JOB_CONTEXT, true);

        assertThat(mappedEntry())
                .extracting(AuditEntry::getTargetName, AuditEntry::getOrganizationId, AuditEntry::getDeviceId)
                .containsExactly("Printer offline at the time", "org-1", "device-7");
    }

    @Test
    void write_targetNameCustomerAndDeviceGiven_readsNoTarget() {
        mapsToAnEvent();

        writer(targetsOf(TICKET_TARGET)).write(List.of(ticketArchive().toBuilder()
                .targetName("Printer offline")
                .organizationId("org-1")
                .deviceId("device-1")
                .build()), JOB_CONTEXT, true);

        assertThat(mappedEntry().getTargetName()).isEqualTo("Printer offline");
        verifyNoInteractions(targetRepository);
    }

    @Test
    void write_targetNotStored_passesTheEntryOnWithoutItsName() {
        mapsToAnEvent();
        when(targetRepository.load(List.of(TICKET_TARGET), "ticket-1")).thenReturn(Optional.empty());

        writer(targetsOf(TICKET_TARGET)).write(List.of(ticketArchive()), JOB_CONTEXT, true);

        assertThat(mappedEntry()).extracting(AuditEntry::getTargetId, AuditEntry::getTargetName)
                .containsExactly("ticket-1", null);
    }

    @Test
    void write_targetReadFails_passesTheEntryOnWithoutItsName() {
        mapsToAnEvent();
        when(targetRepository.load(List.of(TICKET_TARGET), "ticket-1"))
                .thenThrow(new DataAccessResourceFailureException("mongo down"));

        writer(targetsOf(TICKET_TARGET)).write(List.of(ticketArchive()), JOB_CONTEXT, true);

        assertThat(mappedEntry()).extracting(AuditEntry::getTargetId, AuditEntry::getTargetName)
                .containsExactly("ticket-1", null);
    }

    @Test
    void write_targetWithoutIdNotKeyedByTenant_passesItOnWithoutIdAndReadsNothing() {
        mapsToAnEvent();

        writer(targetsOf(TICKET_TARGET)).write(List.of(entry(AuditAction.TICKET_ARCHIVE)), JOB_CONTEXT, true);

        assertThat(mappedEntry().getTargetId()).isNull();
        verify(tenantResolver, never()).isolatedTenantId();
        verifyNoInteractions(targetRepository);
    }

    @Test
    void write_targetKeyedByTenantWithoutId_readsItByTheServedTenant() {
        mapsToAnEvent();
        AuditTarget<SSOPerTenantConfig> ssoTarget = AuditTarget.of(AuditTargetType.SSO_CONFIG,
                SSOPerTenantConfig.class, SSOPerTenantConfig::getProvider).withIdField(AuditTarget.TENANT_ID_FIELD);
        SSOPerTenantConfig config = new SSOPerTenantConfig();
        config.setProvider("google");
        when(tenantResolver.isolatedTenantId()).thenReturn(SERVED_TENANT_ID);
        when(targetRepository.load(List.of(ssoTarget), SERVED_TENANT_ID))
                .thenReturn(Optional.of(new LoadedTarget(ssoTarget, config)));

        writer(targetsOf(ssoTarget)).write(List.of(entry(AuditAction.SSO_CONFIG_TOGGLE)), JOB_CONTEXT, true);

        assertThat(mappedEntry()).extracting(AuditEntry::getTargetId, AuditEntry::getTargetName)
                .containsExactly(SERVED_TENANT_ID, "google");
    }

    @Test
    void write_secretTargetId_passesOnItsHash() {
        mapsToAnEvent();

        writer(targetsOf(invitationTarget())).write(List.of(entry(AuditAction.INVITATION_REVOKE).toBuilder()
                .targetId("abc")
                .targetName("new@acme.com")
                .build()), JOB_CONTEXT, true);

        assertThat(mappedEntry().getTargetId())
                .isEqualTo("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    }

    @Test
    void write_secretTargetWithoutId_passesItOnWithoutId() {
        mapsToAnEvent();

        writer(targetsOf(invitationTarget())).write(List.of(entry(AuditAction.INVITATION_REVOKE)), JOB_CONTEXT, true);

        assertThat(mappedEntry().getTargetId()).isNull();
    }

    @Test
    void write_loadTargetOff_passesTheEntryOnUnread() {
        mapsToAnEvent();

        writer(targetsOf(TICKET_TARGET)).write(List.of(ticketArchive()), JOB_CONTEXT, false);

        assertThat(mappedEntry().getTargetId()).isEqualTo("ticket-1");
        verifyNoInteractions(targetRepository);
    }

    @Test
    void hasChildren_eventStoredUnderAParent_isTrue() {
        mapsTo(AuditEvent.builder().id("event-2").parentEventId("event-1").build());

        writer.write(List.of(entry(AuditAction.TICKET_ARCHIVE)), JOB_CONTEXT, true);

        assertThat(writer.hasChildren("event-1")).isTrue();
    }

    @Test
    void hasChildren_eventUnderAParentNotStored_isFalse() {
        AuditEvent event = mapsTo(AuditEvent.builder().id("event-2").parentEventId("event-1").build());
        when(auditEventRepository.insert(List.of(event))).thenThrow(new DataAccessResourceFailureException("mongo down"));

        writer.write(List.of(entry(AuditAction.TICKET_ARCHIVE)), JOB_CONTEXT, true);

        assertThat(writer.hasChildren("event-1")).isFalse();
    }

    @Test
    void hasChildren_noEventStoredUnderIt_isFalse() {
        mapsTo(AuditEvent.builder().id("event-2").build());

        writer.write(List.of(entry(AuditAction.TICKET_ARCHIVE)), JOB_CONTEXT, true);

        assertThat(writer.hasChildren("event-1")).isFalse();
    }

    @Test
    void targetIdOf_tenantWithoutId_isTheServedTenant() {
        when(tenantResolver.isolatedTenantId()).thenReturn(SERVED_TENANT_ID);

        assertThat(writer.targetIdOf(AuditTargetType.TENANT, null)).isEqualTo(SERVED_TENANT_ID);
    }

    static Stream<AuditActor> people() {
        return Stream.of(
                AuditActor.fromUser(USER_ID, "anna@acme.com", List.of("ADMIN"), SERVED_TENANT_ID, SUPER_TENANT_ID),
                AuditActor.staff("staff-1"));
    }

    private AuditEventWriter writer(AuditTargetRegistry targets) {
        return new AuditEventWriter(auditEventRepository, userRepository, machineRepository, targetRepository,
                tenantResolver, targets, auditEventMapper, new ObjectMapper(), auditClock);
    }

    private static AuditTargetRegistry targetsOf(AuditTarget<?> target) {
        return new AuditTargetRegistry(List.of(() -> List.of(target)));
    }

    private static AuditTarget<Invitation> invitationTarget() {
        return AuditTarget.of(AuditTargetType.INVITATION, Invitation.class, Invitation::getEmail).withSecretId(true);
    }

    private AuditEvent mapsToAnEvent() {
        return mapsTo(AuditEvent.builder().id("event-1").build());
    }

    private AuditEvent mapsTo(AuditEvent event) {
        when(auditEventMapper.toEvent(any(), any(), any(), any(), any(), any())).thenReturn(event);
        return event;
    }

    private AuditEntry mappedEntry() {
        verify(auditEventMapper).toEvent(entryCaptor.capture(), any(), any(), any(), any(), any());
        return entryCaptor.getValue();
    }

    private List<AuditEvent> savedEvents() {
        verify(auditEventRepository).insert(eventsCaptor.capture());
        return eventsCaptor.getValue();
    }

    private static AuditContext contextOf(AuditActor actor) {
        return new AuditContext(actor, REQUEST_INFO, null);
    }

    private static AuditEntry entry(AuditAction action) {
        return AuditEntry.builder().action(action).outcome(AuditOutcome.SUCCESS).build();
    }

    private static AuditEntry ticketArchive() {
        return entry(AuditAction.TICKET_ARCHIVE).toBuilder().targetId("ticket-1").build();
    }

    private static Optional<LoadedTarget> storedTicket() {
        Ticket ticket = new Ticket();
        ticket.setTitle("Printer offline");
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
}
