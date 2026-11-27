package com.openframe.api.service.ticket;

import com.openframe.api.dto.ticket.UpdateTicketInput;
import com.openframe.api.service.AssignmentService;
import com.openframe.api.service.device.ClientOwnerScopeResolver;
import com.openframe.audit.AuditRecorder;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.data.document.audit.AuditChange;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.user.User;
import com.openframe.data.model.audit.AuditEntry;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.organization.OrganizationRepository;
import com.openframe.data.repository.ticket.TicketRepository;
import com.openframe.data.repository.user.UserRepository;
import com.openframe.security.authentication.ActorType;
import com.openframe.security.authentication.AuthPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static com.openframe.data.document.audit.AuditAction.TICKET_ASSIGN;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TicketServiceUpdateAssigneeTest {

    private static final String TICKET_ID = "t-1";
    private static final AuthPrincipal ADMIN = AuthPrincipal.builder().id("admin-1").actorType(ActorType.ADMIN).build();

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
    @Mock private AuditedMethodRunner auditedMethodRunner;
    @Mock private AuditRecorder auditRecorder;

    private TicketService service;

    @BeforeEach
    void setUp() {
        service = new TicketService(ticketRepository, ticketNumberService, ticketTagService, ticketIdsForFilter,
                ticketStalenessResolver, machineRepository, organizationRepository, userRepository, assignmentService,
                ticketLifecycleService, ticketResolverStamp, clientOwnerScopeResolver, List.of(), auditedMethodRunner,
                auditRecorder);
    }

    @Test
    void updateTicket_anotherAssignee_recordsTheAssignmentWithTheChange() {
        givenTicketAssignedTo("u-old");
        givenUser("u-new");

        service.updateTicket(ADMIN, TICKET_ID, UpdateTicketInput.builder().id(TICKET_ID).assigneeId("u-new").build());

        ArgumentCaptor<AuditEntry> entry = ArgumentCaptor.forClass(AuditEntry.class);
        verify(auditRecorder).record(entry.capture());
        assertThat(entry.getValue())
                .extracting(AuditEntry::getAction, AuditEntry::getTargetId, AuditEntry::getDetails, AuditEntry::getChanges)
                .containsExactly(TICKET_ASSIGN, TICKET_ID, Map.of("assigneeId", "u-new"),
                        Map.of("assignedTo", new AuditChange("u-old", "u-new"),
                                "assignedName", new AuditChange("Name u-old", "Name u-new")));
    }

    @Test
    void updateTicket_sameAssignee_recordsNoAssignment() {
        givenTicketAssignedTo("u-1");
        givenUser("u-1");

        service.updateTicket(ADMIN, TICKET_ID, UpdateTicketInput.builder().id(TICKET_ID).assigneeId("u-1").build());

        verify(auditRecorder, never()).record(any());
    }

    private void givenTicketAssignedTo(String assigneeId) {
        Ticket ticket = Ticket.builder().id(TICKET_ID).assignedTo(assigneeId).assignedName("Name " + assigneeId).build();
        when(ticketRepository.findById(TICKET_ID)).thenReturn(Optional.of(ticket));
        when(ticketRepository.save(ticket)).thenReturn(ticket);
    }

    private void givenUser(String userId) {
        User user = new User();
        user.setId(userId);
        user.setFirstName("Name");
        user.setLastName(userId);
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
    }
}
