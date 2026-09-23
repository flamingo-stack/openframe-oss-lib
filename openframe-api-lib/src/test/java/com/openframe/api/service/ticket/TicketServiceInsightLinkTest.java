package com.openframe.api.service.ticket;

import com.openframe.api.dto.ticket.CreateTicketInput;
import com.openframe.api.service.AssignmentService;
import com.openframe.api.service.ticket.spi.TicketEventListener;
import com.openframe.data.document.assignment.AssignmentItemType;
import com.openframe.data.document.assignment.AssignmentTargetType;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.organization.OrganizationRepository;
import com.openframe.data.repository.ticket.TicketRepository;
import com.openframe.data.repository.user.UserRepository;
import com.openframe.security.authentication.ActorType;
import com.openframe.security.authentication.AuthPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.ArrayList;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TicketServiceInsightLinkTest {

    private static final String TICKET_ID = "ticket-1";
    private static final String INSIGHT_ID = "76a7482b-6daa-3354-8671-d41d70d51abb";

    @Mock private TicketRepository ticketRepository;
    @Mock private TicketNumberService ticketNumberService;
    @Mock private TicketTagService ticketTagService;
    @Mock private TicketIdsForFilter ticketIdsForFilter;
    @Mock private MachineRepository machineRepository;
    @Mock private OrganizationRepository organizationRepository;
    @Mock private UserRepository userRepository;
    @Mock private AssignmentService assignmentService;
    @Mock private TicketLifecycleService ticketLifecycleService;
    @Mock private TicketResolverStamp ticketResolverStamp;
    @Mock private TicketStalenessResolver ticketStalenessResolver;
    @Spy private List<TicketEventListener> listeners = new ArrayList<>();

    @InjectMocks private TicketService service;

    private AuthPrincipal admin;

    @BeforeEach
    void setUp() {
        admin = AuthPrincipal.builder().id("admin-1").actorType(ActorType.ADMIN).build();

        Ticket saved = Ticket.builder().id(TICKET_ID).build();
        when(ticketRepository.save(any(Ticket.class))).thenReturn(saved);
        when(ticketNumberService.getNextTicketNumber()).thenReturn(7);
    }

    private CreateTicketInput inputWithInsight(String insightId) {
        return CreateTicketInput.builder().title("Disk almost full").insightId(insightId).build();
    }

    @Test
    void aTicketFiledFromAnInsightIsLinkedToIt() {
        service.createTicket(admin, inputWithInsight(INSIGHT_ID));

        verify(assignmentService).assignItem(
                INSIGHT_ID, AssignmentItemType.INSIGHT, AssignmentTargetType.TICKET, TICKET_ID);
    }

    @Test
    void aTicketFiledOnItsOwnIsLinkedToNothing() {
        service.createTicket(admin, inputWithInsight(null));

        verify(assignmentService, never()).assignItem(
                anyString(), any(AssignmentItemType.class), any(AssignmentTargetType.class), anyString());
    }

    @Test
    void aBlankInsightIsTreatedAsNoLink() {
        service.createTicket(admin, inputWithInsight("  "));

        verify(assignmentService, never()).assignItem(
                anyString(), any(AssignmentItemType.class), any(AssignmentTargetType.class), anyString());
    }
}
