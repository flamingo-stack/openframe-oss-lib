package com.openframe.api.service.ticket;

import com.openframe.api.dto.ticket.TicketFilterInput;
import com.openframe.api.service.AssignmentService;
import com.openframe.api.service.ticket.spi.TicketEventListener;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.ticket.TicketStatusKind;
import com.openframe.data.document.ticket.filter.TicketQueryFilter;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.organization.OrganizationRepository;
import com.openframe.data.repository.ticket.TicketRepository;
import com.openframe.data.repository.user.UserRepository;
import com.openframe.security.authentication.ActorType;
import com.openframe.security.authentication.AuthPrincipal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.query.Query;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Status filtering is expressed in lifecycle status ids and nothing else: what the caller asks for
 * has to reach the repository query unchanged, and an absent filter must not silently narrow the
 * result set.
 */
@ExtendWith(MockitoExtension.class)
class TicketServiceStatusFilterTest {

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
    @Mock private TicketEventListener listener;

    @Spy private List<TicketEventListener> listeners = new ArrayList<>();

    @InjectMocks private TicketService service;

    private final AuthPrincipal admin = AuthPrincipal.builder()
            .id("admin-1")
            .actorType(ActorType.ADMIN)
            .build();

    @Test
    void getTickets_forwardsStatusIdsToTheQuery() {
        List<String> statusIds = List.of("st-ai", "st-tech");
        givenRepositoryReturns(List.of(ticket("ticket-1")));

        service.getTickets(admin, TicketFilterInput.builder().statusIds(statusIds).build(), null, null, null);

        assertThat(capturedFilter().getStatusIds()).isEqualTo(statusIds);
    }

    @Test
    void getTickets_withoutFilter_appliesNoStatusNarrowing() {
        givenRepositoryReturns(List.of(ticket("ticket-1")));

        service.getTickets(admin, null, null, null, null);

        assertThat(capturedFilter().getStatusIds()).isNull();
    }

    @Test
    void getTickets_forAgent_isScopedToTheOwningMachine() {
        AuthPrincipal agent = AuthPrincipal.builder()
                .id("agent-1")
                .actorType(ActorType.AGENT)
                .machineId("machine-7")
                .build();
        givenRepositoryReturns(List.of());

        service.getTickets(agent, TicketFilterInput.builder().build(), null, null, null);

        verify(ticketRepository).buildTicketQuery(any(), isNull(), any(), eq("machine-7"));
    }

    private void givenRepositoryReturns(List<Ticket> page) {
        Query query = new Query();
        when(ticketRepository.buildTicketQuery(any(), any(), any(), any())).thenReturn(query);
        when(ticketRepository.countTickets(query)).thenReturn((long) page.size());
        when(ticketRepository.findTicketsWithCursor(eq(query), any(), anyInt(), any(), any()))
                .thenReturn(page);
    }

    private TicketQueryFilter capturedFilter() {
        ArgumentCaptor<TicketQueryFilter> captor = ArgumentCaptor.forClass(TicketQueryFilter.class);
        verify(ticketRepository).buildTicketQuery(captor.capture(), any(), any(), any());
        return captor.getValue();
    }

    private static Ticket ticket(String id) {
        return Ticket.builder()
                .id(id)
                .statusId("st-ai")
                .statusKind(TicketStatusKind.AI_ASSISTANCE)
                .build();
    }
}
