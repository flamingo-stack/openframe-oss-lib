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

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
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
    void write_apiKeyWithoutName_readsNoName() {
        mapsToAnEvent();

        writer.write(List.of(entry(AuditAction.TICKET_ARCHIVE)),
                contextOf(AuditActor.fromApiKey("key-9", null, null, null, null)), true);

        assertThat(savedEvents()).extracting(AuditEvent::getActorName).containsOnlyNulls();
        verifyNoInteractions(userRepository, machineRepository);
    }

    @Test
    void write_actorNameReadFails_storesTheEventWithoutTheName() {
        mapsToAnEvent();
        when(userRepository.findById("staff-1")).thenThrow(new DataAccessResourceFailureException("mongo down"));

        writer.write(List.of(entry(AuditAction.TICKET_ARCHIVE)), contextOf(AuditActor.staff("staff-1")), true);

        assertThat(savedEvents()).extracting(AuditEvent::getActorName).containsOnlyNulls();
        assertLoggedDataAccessError("Audit lookup of the user name failed, the event is stored without it");
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
    void write_deviceWithoutCustomer_takesTheCustomerOfTheDevice() {
        mapsToAnEvent();
        AuditTarget<Machine> deviceTarget = AuditTarget.of(AuditTargetType.DEVICE, Machine.class, Machine::deviceName)
                .withOrganizationId(Machine::getOrganizationId);
        Machine device = new Machine();
        device.setOrganizationId("org-9");
        when(targetRepository.load(List.of(deviceTarget), MACHINE_ID))
                .thenReturn(Optional.of(new LoadedTarget(deviceTarget, device)));

        writer(targetsOf(deviceTarget)).write(List.of(entry(AuditAction.SCRIPT_RUN).toBuilder()
                .targetId("script-1")
                .deviceId(MACHINE_ID)
                .build()), JOB_CONTEXT, false);

        assertThat(mappedEntry().getOrganizationId()).isEqualTo("org-9");
    }

    @Test
    void write_targetReadFails_passesTheEntryOnWithoutItsName() {
        mapsToAnEvent();
        when(targetRepository.load(List.of(TICKET_TARGET), "ticket-1"))
                .thenThrow(new DataAccessResourceFailureException("mongo down"));

        writer(targetsOf(TICKET_TARGET)).write(List.of(ticketArchive()), JOB_CONTEXT, true);

        assertThat(mappedEntry()).extracting(AuditEntry::getTargetId, AuditEntry::getTargetName)
                .containsExactly("ticket-1", null);
        assertLoggedDataAccessError("Audit target ticket-1 not read, ticket.archive is stored without its name");
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
    void write_secretTargetId_readsTheRecordByThePlainIdAndPassesOnItsHash() {
        mapsToAnEvent();
        AuditTarget<Invitation> invitations = invitationTarget();
        Invitation invitation = new Invitation();
        invitation.setEmail("new@acme.com");
        when(targetRepository.load(List.of(invitations), "abc"))
                .thenReturn(Optional.of(new LoadedTarget(invitations, invitation)));

        writer(targetsOf(invitations)).write(
                List.of(entry(AuditAction.INVITATION_REVOKE).toBuilder().targetId("abc").build()), JOB_CONTEXT, true);

        assertThat(mappedEntry()).extracting(AuditEntry::getTargetId, AuditEntry::getTargetName)
                .containsExactly("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", "new@acme.com");
    }

    @Test
    void write_loadTargetOff_passesTheEntryOnUnread() {
        mapsToAnEvent();

        writer(targetsOf(TICKET_TARGET)).write(List.of(ticketArchive()), JOB_CONTEXT, false);

        assertThat(mappedEntry().getTargetId()).isEqualTo("ticket-1");
        verifyNoInteractions(targetRepository);
    }

    @Test
    void write_targetRecordOfAnotherTenant_passesTheEntryOnWithoutItsNameCustomerDeviceAndChanges() {
        mapsToAnEvent();
        when(tenantResolver.tenantFor(any(), any())).thenReturn("tenant-a");
        when(tenantResolver.belongsToAnotherTenant("tenant-b", "tenant-a")).thenReturn(true);

        writer.write(List.of(namedTicketArchiveOf("tenant-b")), JOB_CONTEXT, false);

        assertThat(mappedEntry())
                .extracting(AuditEntry::getTargetId, AuditEntry::getTargetName, AuditEntry::getOrganizationId,
                        AuditEntry::getDeviceId, AuditEntry::getChanges, AuditEntry::getDetails)
                .containsExactly("ticket-1", null, null, null, null, Map.of("via", "dialog"));
    }

    @Test
    void write_targetRecordOfTheEventsTenant_passesTheEntryOnWhole() {
        mapsToAnEvent();
        when(tenantResolver.tenantFor(any(), any())).thenReturn("tenant-a");
        when(tenantResolver.belongsToAnotherTenant("tenant-a", "tenant-a")).thenReturn(false);
        AuditEntry entry = namedTicketArchiveOf("tenant-a");

        writer.write(List.of(entry), JOB_CONTEXT, false);

        assertThat(mappedEntry())
                .extracting(AuditEntry::getTargetName, AuditEntry::getOrganizationId, AuditEntry::getDeviceId,
                        AuditEntry::getChanges)
                .containsExactly("Printer offline", "org-7", "device-7", entry.getChanges());
    }

    @Test
    void write_targetReadFromARecordOfAnotherTenant_passesTheEntryOnWithoutThatRecordsFields() {
        mapsToAnEvent();
        when(tenantResolver.tenantFor(any(), any())).thenReturn("tenant-a");
        when(tenantResolver.belongsToAnotherTenant("tenant-b", "tenant-a")).thenReturn(true);
        Optional<LoadedTarget> foreignTicket = storedTicket();
        ((Ticket) foreignTicket.orElseThrow().document()).setTenantId("tenant-b");
        when(targetRepository.load(List.of(TICKET_TARGET), "ticket-1")).thenReturn(foreignTicket);

        writer(targetsOf(TICKET_TARGET)).write(List.of(ticketArchive()), JOB_CONTEXT, true);

        assertThat(mappedEntry())
                .extracting(AuditEntry::getTargetName, AuditEntry::getOrganizationId, AuditEntry::getDeviceId)
                .containsExactly(null, null, null);
    }

    @Test
    void write_callerNamesTheTargetsTenantAndTheRecordReadHasNone_keepsTheCallersTenant() {
        mapsToAnEvent();
        when(targetRepository.load(List.of(TICKET_TARGET), "ticket-1")).thenReturn(storedTicket());

        writer(targetsOf(TICKET_TARGET)).write(
                List.of(ticketArchive().toBuilder().targetTenantId("tenant-b").build()), JOB_CONTEXT, true);

        assertThat(mappedEntry().getTargetTenantId()).isEqualTo("tenant-b");
    }

    @Test
    void hadChildren_eventStoredUnderATrackedAction_isTrue() {
        mapsTo(AuditEvent.builder().id("event-2").parentEventId("event-1").build());
        writer.trackChildrenOf("event-1");

        writer.write(List.of(entry(AuditAction.TICKET_ARCHIVE)), JOB_CONTEXT, true);

        assertThat(writer.hadChildren("event-1")).isTrue();
    }

    @Test
    void hadChildren_eventUnderATrackedActionNotStored_isFalse() {
        AuditEvent event = mapsTo(AuditEvent.builder().id("event-2").parentEventId("event-1").build());
        when(auditEventRepository.insert(List.of(event))).thenThrow(new DataAccessResourceFailureException("mongo down"));
        writer.trackChildrenOf("event-1");

        writer.write(List.of(entry(AuditAction.TICKET_ARCHIVE)), JOB_CONTEXT, true);

        assertThat(writer.hadChildren("event-1")).isFalse();
    }

    @Test
    void hadChildren_noEventStoredUnderTheTrackedAction_isFalse() {
        mapsTo(AuditEvent.builder().id("event-2").build());
        writer.trackChildrenOf("event-1");

        writer.write(List.of(entry(AuditAction.TICKET_ARCHIVE)), JOB_CONTEXT, true);

        assertThat(writer.hadChildren("event-1")).isFalse();
    }

    @Test
    void hadChildren_eventStoredUnderAnActionThatIsNotTracked_isFalse() {
        mapsTo(AuditEvent.builder().id("event-2").parentEventId("event-1").build());

        writer.write(List.of(entry(AuditAction.TICKET_ARCHIVE)), JOB_CONTEXT, true);

        assertThat(writer.hadChildren("event-1")).isFalse();
    }

    @Test
    void hadChildren_askedASecondTime_isFalse() {
        mapsTo(AuditEvent.builder().id("event-2").parentEventId("event-1").build());
        writer.trackChildrenOf("event-1");
        writer.write(List.of(entry(AuditAction.TICKET_ARCHIVE)), JOB_CONTEXT, true);
        writer.hadChildren("event-1");

        assertThat(writer.hadChildren("event-1")).isFalse();
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

    private void assertLoggedDataAccessError(String message) {
        assertThat(appender.list)
                .extracting(ILoggingEvent::getLevel, ILoggingEvent::getFormattedMessage,
                        logged -> logged.getThrowableProxy().getClassName())
                .containsExactly(tuple(Level.ERROR, message, DataAccessResourceFailureException.class.getName()));
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

    private static AuditEntry namedTicketArchiveOf(String targetTenantId) {
        return ticketArchive().toBuilder()
                .targetName("Printer offline")
                .organizationId("org-7")
                .deviceId("device-7")
                .targetTenantId(targetTenantId)
                .details(Map.of("via", "dialog"))
                .changes(Map.of("statusKind", new AuditChange("OPEN", "ARCHIVED")))
                .build();
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
