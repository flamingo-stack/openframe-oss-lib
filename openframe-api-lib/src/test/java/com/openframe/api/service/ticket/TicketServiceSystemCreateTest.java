package com.openframe.api.service.ticket;

import com.openframe.api.dto.ticket.SystemTicketCommand;
import com.openframe.api.service.AssignmentService;
import com.openframe.api.service.device.ClientOwnerScopeResolver;
import com.openframe.api.service.ticket.spi.TicketEventListener;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.organization.Organization;
import com.openframe.data.document.organization.OrganizationStatus;
import com.openframe.data.document.ticket.EmailTicketOwner;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.ticket.TicketCreationSource;
import com.openframe.data.document.ticket.TicketEmailOrigin;
import com.openframe.data.document.ticket.TicketRequester;
import com.openframe.data.document.ticket.TicketRequesterMatch;
import com.openframe.data.document.ticket.TicketStatusKind;
import com.openframe.data.document.user.User;
import com.openframe.data.document.user.UserStatus;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.organization.OrganizationRepository;
import com.openframe.data.repository.ticket.TicketRepository;
import com.openframe.data.repository.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TicketServiceSystemCreateTest {

    private static final String TICKET_ID = "6740a1b2c3d4e5f601234567";
    private static final int TICKET_NUMBER = 42;
    private static final String SENDER = "ada@contoso.com";
    private static final String TITLE = "Printer is offline";
    private static final String DESCRIPTION = "The printer on floor 2 shows offline since this morning.";
    private static final String STATUS_ID = "st-custom";
    private static final String ORDER = "0|hzzzzz:";
    private static final String TECH_REQUIRED_STATUS_ID = "st-tech";
    private static final String TECH_REQUIRED_ORDER = "0|hzzzzy:";
    private static final String ASSIGNEE_ID = "user-9";
    private static final String ORGANIZATION_ID = "org-1";
    private static final String ORGANIZATION_NAME = "Contoso";
    private static final String OTHER_ORGANIZATION_ID = "org-2";
    private static final String MACHINE_ID = "machine-1";
    private static final String HOSTNAME = "CONTOSO-PC-07";
    private static final String MAILBOX_ID = "mailbox-1";
    private static final String MAILBOX_ADDRESS = "help@msp.example";
    private static final String SUBJECT_KEY = "printer is offline";
    private static final Instant RECEIVED_AT = Instant.parse("2026-11-20T09:15:00Z");
    private static final String REQUESTER_ACCOUNT_ID = "org-user-1";
    private static final String REQUESTER_NAME = "Ada Lovelace";

    @Mock private TicketRepository ticketRepository;
    @Mock private TicketNumberService ticketNumberService;
    @Mock private TicketTagService ticketTagService;
    @Mock private TicketIdsForFilter ticketIdsForFilter;
    @Mock private TicketStalenessResolver ticketStalenessResolver;
    @Mock private MachineRepository machineRepository;
    @Mock private OrganizationRepository organizationRepository;
    @Mock private UserRepository userRepository;
    @Mock private AssignmentService assignmentService;
    @Mock private TicketLifecycleService ticketLifecycleService;
    @Mock private TicketResolverStamp ticketResolverStamp;
    @Mock private ClientOwnerScopeResolver clientOwnerScopeResolver;
    @Mock private TicketEventListener listener;

    @Captor private ArgumentCaptor<Ticket> ticketCaptor;

    private TicketService service;

    private TicketEmailOrigin emailOrigin;
    private TicketRequester requester;

    @BeforeEach
    void setUp() {
        service = new TicketService(ticketRepository, ticketNumberService, ticketTagService, ticketIdsForFilter,
                ticketStalenessResolver, machineRepository, organizationRepository, userRepository, assignmentService,
                ticketLifecycleService, ticketResolverStamp, clientOwnerScopeResolver, List.of(listener));
        emailOrigin = TicketEmailOrigin.builder()
                .mailboxId(MAILBOX_ID)
                .mailboxAddress(MAILBOX_ADDRESS)
                .senderAddress(SENDER)
                .cc(List.of("bob@contoso.com"))
                .subjectKey(SUBJECT_KEY)
                .lastEmailAt(RECEIVED_AT)
                .build();
        requester = TicketRequester.builder()
                .accountId(REQUESTER_ACCOUNT_ID)
                .name(REQUESTER_NAME)
                .email(SENDER)
                .directoryProvider("MICROSOFT_365")
                .matchedBy(TicketRequesterMatch.EMAIL)
                .matchedAddress(SENDER)
                .build();
    }

    @Test
    void createSystemTicket_emailCommand_savedWithIdNumberSourceOwner() {
        // setup
        stubCommon();
        SystemTicketCommand command = emailCommand().build();

        // execution
        service.createSystemTicket(command);

        // verifications
        verify(ticketRepository).save(ticketCaptor.capture());
        assertThat(ticketCaptor.getValue())
                .extracting(Ticket::getId, Ticket::getTicketNumber, Ticket::getCreationSource, Ticket::getOwner,
                        Ticket::getTitle, Ticket::getDescription)
                .containsExactly(TICKET_ID, TICKET_NUMBER, TicketCreationSource.EMAIL, new EmailTicketOwner(SENDER),
                        TITLE, DESCRIPTION);
    }

    @Test
    void createSystemTicket_emailCommand_originRequesterReporterNameSaved() {
        // setup
        stubCommon();
        SystemTicketCommand command = emailCommand().build();

        // execution
        service.createSystemTicket(command);

        // verifications
        verify(ticketRepository).save(ticketCaptor.capture());
        assertThat(ticketCaptor.getValue())
                .extracting(Ticket::getEmailOrigin, Ticket::getRequester, Ticket::getReporterName, Ticket::getReporterId)
                .containsExactly(emailOrigin, requester, REQUESTER_NAME, null);
    }

    @Test
    void createSystemTicket_noRequester_reporterNameAndReporterIdNull() {
        // setup
        stubCommon();
        SystemTicketCommand command = emailCommand().requester(null).reporterName(null).build();

        // execution
        service.createSystemTicket(command);

        // verifications
        verify(ticketRepository).save(ticketCaptor.capture());
        assertThat(ticketCaptor.getValue())
                .extracting(Ticket::getRequester, Ticket::getReporterName, Ticket::getReporterId)
                .containsExactly(null, null, null);
    }

    @Test
    void createSystemTicket_status_appliedBeforeTopOrderOfThatColumn() {
        // setup
        stubCommon();
        SystemTicketCommand command = emailCommand().build();
        InOrder inOrder = inOrder(ticketLifecycleService, ticketRepository);

        // execution
        Ticket result = service.createSystemTicket(command);

        // verifications
        inOrder.verify(ticketLifecycleService).applySystemInitialStatus(result, STATUS_ID);
        inOrder.verify(ticketLifecycleService).computeRankAtTop(STATUS_ID);
        inOrder.verify(ticketRepository).save(result);
        assertThat(result)
                .extracting(Ticket::getStatusId, Ticket::getStatusKind, Ticket::getOrder)
                .containsExactly(STATUS_ID, TicketStatusKind.CUSTOM, ORDER);
    }

    @Test
    void createSystemTicket_statusFallsBack_orderAtTopOfAppliedStatus() {
        // setup
        when(ticketNumberService.getNextTicketNumber()).thenReturn(TICKET_NUMBER);
        doAnswer(invocation -> {
            Ticket ticket = invocation.getArgument(0);
            ticket.setStatusId(TECH_REQUIRED_STATUS_ID);
            ticket.setStatusKind(TicketStatusKind.TECH_REQUIRED);
            return null;
        }).when(ticketLifecycleService).applySystemInitialStatus(any(Ticket.class), eq(STATUS_ID));
        when(ticketLifecycleService.computeRankAtTop(TECH_REQUIRED_STATUS_ID)).thenReturn(TECH_REQUIRED_ORDER);
        when(ticketRepository.save(any(Ticket.class))).thenAnswer(invocation -> invocation.getArgument(0));
        SystemTicketCommand command = emailCommand().build();
        InOrder inOrder = inOrder(ticketLifecycleService, ticketRepository);

        // execution
        Ticket result = service.createSystemTicket(command);

        // verifications
        inOrder.verify(ticketLifecycleService).applySystemInitialStatus(result, STATUS_ID);
        inOrder.verify(ticketLifecycleService).computeRankAtTop(TECH_REQUIRED_STATUS_ID);
        inOrder.verify(ticketRepository).save(result);
        assertThat(result)
                .extracting(Ticket::getStatusId, Ticket::getStatusKind, Ticket::getOrder)
                .containsExactly(TECH_REQUIRED_STATUS_ID, TicketStatusKind.TECH_REQUIRED, TECH_REQUIRED_ORDER);
    }

    @Test
    void createSystemTicket_assigneeActive_assignedToAndName() {
        // setup
        stubCommon();
        when(userRepository.findById(ASSIGNEE_ID)).thenReturn(Optional.of(user(UserStatus.ACTIVE)));
        SystemTicketCommand command = emailCommand().assigneeId(ASSIGNEE_ID).build();

        // execution
        service.createSystemTicket(command);

        // verifications
        verify(ticketRepository).save(ticketCaptor.capture());
        assertThat(ticketCaptor.getValue())
                .extracting(Ticket::getAssignedTo, Ticket::getAssignedName)
                .containsExactly(ASSIGNEE_ID, "Tess Tech");
    }

    @ParameterizedTest
    @MethodSource("unusableAssignees")
    void createSystemTicket_assigneeNotUsable_unassigned(String assigneeId, Optional<User> found) {
        // setup
        stubCommon();
        lenient().when(userRepository.findById(assigneeId)).thenReturn(found);
        SystemTicketCommand command = emailCommand().assigneeId(assigneeId).build();

        // execution
        service.createSystemTicket(command);

        // verifications
        verify(ticketRepository).save(ticketCaptor.capture());
        assertThat(ticketCaptor.getValue())
                .extracting(Ticket::getAssignedTo, Ticket::getAssignedName)
                .containsExactly(null, null);
    }

    @Test
    void createSystemTicket_organizationActive_idAndNameSet() {
        // setup
        stubCommon();
        when(organizationRepository.findByOrganizationId(ORGANIZATION_ID))
                .thenReturn(Optional.of(organization(OrganizationStatus.ACTIVE)));
        SystemTicketCommand command = emailCommand().organizationId(ORGANIZATION_ID).build();

        // execution
        service.createSystemTicket(command);

        // verifications
        verify(ticketRepository).save(ticketCaptor.capture());
        assertThat(ticketCaptor.getValue())
                .extracting(Ticket::getOrganizationId, Ticket::getOrganizationName)
                .containsExactly(ORGANIZATION_ID, ORGANIZATION_NAME);
    }

    @ParameterizedTest
    @MethodSource("unusableOrganizations")
    void createSystemTicket_organizationNotUsable_noOrganization(Optional<Organization> found) {
        // setup
        stubCommon();
        when(organizationRepository.findByOrganizationId(ORGANIZATION_ID)).thenReturn(found);
        SystemTicketCommand command = emailCommand().organizationId(ORGANIZATION_ID).build();

        // execution
        service.createSystemTicket(command);

        // verifications
        verify(ticketRepository).save(ticketCaptor.capture());
        assertThat(ticketCaptor.getValue())
                .extracting(Ticket::getOrganizationId, Ticket::getOrganizationName)
                .containsExactly(null, null);
    }

    @Test
    void createSystemTicket_deviceOfAnotherOrganization_deviceKeptOrganizationUnchanged() {
        // setup
        stubCommon();
        when(organizationRepository.findByOrganizationId(ORGANIZATION_ID))
                .thenReturn(Optional.of(organization(OrganizationStatus.ACTIVE)));
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine(OTHER_ORGANIZATION_ID)));
        SystemTicketCommand command = emailCommand().organizationId(ORGANIZATION_ID).deviceId(MACHINE_ID).build();

        // execution
        service.createSystemTicket(command);

        // verifications
        verify(ticketRepository).save(ticketCaptor.capture());
        assertThat(ticketCaptor.getValue())
                .extracting(Ticket::getDeviceId, Ticket::getDeviceHostname, Ticket::getOrganizationId,
                        Ticket::getOrganizationName)
                .containsExactly(MACHINE_ID, HOSTNAME, ORGANIZATION_ID, ORGANIZATION_NAME);
    }

    @Test
    void createSystemTicket_deviceButNoOrganization_organizationNotTakenFromDevice() {
        // setup
        stubCommon();
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine(OTHER_ORGANIZATION_ID)));
        SystemTicketCommand command = emailCommand().deviceId(MACHINE_ID).build();

        // execution
        service.createSystemTicket(command);

        // verifications
        verify(ticketRepository).save(ticketCaptor.capture());
        assertThat(ticketCaptor.getValue())
                .extracting(Ticket::getDeviceId, Ticket::getOrganizationId, Ticket::getOrganizationName)
                .containsExactly(MACHINE_ID, null, null);
        verifyNoInteractions(organizationRepository);
    }

    @Test
    void createSystemTicket_deviceMissing_noDeviceNoThrow() {
        // setup
        stubCommon();
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.empty());
        SystemTicketCommand command = emailCommand().deviceId(MACHINE_ID).build();

        // execution
        service.createSystemTicket(command);

        // verifications
        verify(ticketRepository).save(ticketCaptor.capture());
        assertThat(ticketCaptor.getValue())
                .extracting(Ticket::getDeviceId, Ticket::getDeviceHostname)
                .containsExactly(null, null);
    }

    @Test
    void createSystemTicket_withActiveAssignee_onlyOnTicketCreatedBySystem() {
        // setup
        stubCommon();
        when(userRepository.findById(ASSIGNEE_ID)).thenReturn(Optional.of(user(UserStatus.ACTIVE)));
        SystemTicketCommand command = emailCommand().assigneeId(ASSIGNEE_ID).build();

        // execution
        Ticket result = service.createSystemTicket(command);

        // verifications
        verify(listener).onTicketCreatedBySystem(result);
        verifyNoMoreInteractions(listener);
    }

    private void stubCommon() {
        when(ticketNumberService.getNextTicketNumber()).thenReturn(TICKET_NUMBER);
        doAnswer(invocation -> {
            Ticket ticket = invocation.getArgument(0);
            ticket.setStatusId(STATUS_ID);
            ticket.setStatusKind(TicketStatusKind.CUSTOM);
            return null;
        }).when(ticketLifecycleService).applySystemInitialStatus(any(Ticket.class), eq(STATUS_ID));
        when(ticketLifecycleService.computeRankAtTop(STATUS_ID)).thenReturn(ORDER);
        when(ticketRepository.save(any(Ticket.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    private SystemTicketCommand.SystemTicketCommandBuilder emailCommand() {
        return SystemTicketCommand.builder()
                .id(TICKET_ID)
                .creationSource(TicketCreationSource.EMAIL)
                .owner(new EmailTicketOwner(SENDER))
                .title(TITLE)
                .description(DESCRIPTION)
                .statusId(STATUS_ID)
                .emailOrigin(emailOrigin)
                .requester(requester)
                .reporterName(REQUESTER_NAME);
    }

    private static User user(UserStatus status) {
        return User.builder()
                .id(ASSIGNEE_ID)
                .firstName("Tess")
                .lastName("Tech")
                .email("tess@msp.example")
                .status(status)
                .build();
    }

    private static Organization organization(OrganizationStatus status) {
        return Organization.builder()
                .organizationId(ORGANIZATION_ID)
                .name(ORGANIZATION_NAME)
                .status(status)
                .build();
    }

    private static Machine machine(String organizationId) {
        Machine machine = new Machine();
        machine.setMachineId(MACHINE_ID);
        machine.setHostname(HOSTNAME);
        machine.setOrganizationId(organizationId);
        return machine;
    }

    private static Stream<Arguments> unusableAssignees() {
        return Stream.of(
                Arguments.of(ASSIGNEE_ID, Optional.empty()),
                Arguments.of(ASSIGNEE_ID, Optional.of(user(UserStatus.DELETED))),
                Arguments.of(ASSIGNEE_ID, Optional.of(user(UserStatus.SELF_DELETED))),
                Arguments.of(null, Optional.empty()));
    }

    private static Stream<Arguments> unusableOrganizations() {
        return Stream.of(
                Arguments.of(Optional.empty()),
                Arguments.of(Optional.of(organization(OrganizationStatus.ARCHIVED))),
                Arguments.of(Optional.of(organization(OrganizationStatus.DELETED))));
    }
}
