package com.openframe.api.service.ticket;

import com.openframe.api.dto.ticket.ReorderTicketInput;
import com.openframe.api.service.AssignmentService;
import com.openframe.api.service.ticket.spi.TicketEventListener;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.ticket.TicketStatusKind;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.organization.OrganizationRepository;
import com.openframe.data.repository.ticket.TicketRepository;
import com.openframe.data.repository.user.UserRepository;
import com.openframe.security.authentication.ActorType;
import com.openframe.security.authentication.AuthPrincipal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Board drag-and-drop has a single owner: ordering and any column change belong to the lifecycle
 * service, which ranks within a {@code statusId} column. {@code TicketService} only forwards —
 * including when the caller sends no column at all, meaning "same column".
 */
@ExtendWith(MockitoExtension.class)
class TicketServiceReorderTest {

    private static final String TICKET_ID = "ticket-1";
    private static final String COLUMN_ID = "st-tech";

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

    private final AuthPrincipal admin = principal(ActorType.ADMIN);

    @Test
    void reorder_withColumn_isDelegatedToLifecycle() {
        Ticket reordered = ticket();
        ReorderTicketInput input = input(COLUMN_ID);
        when(ticketLifecycleService.reorderTicket(admin, input)).thenReturn(reordered);

        assertThat(service.reorderTicket(admin, input)).isSameAs(reordered);

        verify(ticketLifecycleService).reorderTicket(admin, input);
    }

    /**
     * No {@code statusId} means "same column" — still the lifecycle service's job. Nothing may fall
     * back to a second, legacy ordering path.
     */
    @Test
    void reorder_withoutColumn_isDelegatedToLifecycleToo() {
        Ticket reordered = ticket();
        ReorderTicketInput input = input(null);
        when(ticketLifecycleService.reorderTicket(admin, input)).thenReturn(reordered);

        assertThat(service.reorderTicket(admin, input)).isSameAs(reordered);

        verify(ticketLifecycleService).reorderTicket(admin, input);
    }

    @Test
    void reorder_byNonAdmin_isRejectedBeforeAnyWork() {
        AuthPrincipal agent = principal(ActorType.AGENT);

        assertThatThrownBy(() -> service.reorderTicket(agent, input(COLUMN_ID)))
                .isInstanceOf(IllegalStateException.class);

        verify(ticketLifecycleService, never()).reorderTicket(any(), any());
    }

    private static ReorderTicketInput input(String statusId) {
        return ReorderTicketInput.builder()
                .id(TICKET_ID)
                .afterTicketId("ticket-0")
                .beforeTicketId("ticket-2")
                .statusId(statusId)
                .build();
    }

    private static Ticket ticket() {
        return Ticket.builder()
                .id(TICKET_ID)
                .statusId(COLUMN_ID)
                .statusKind(TicketStatusKind.TECH_REQUIRED)
                .order("0|hzzzzz:")
                .build();
    }

    private static AuthPrincipal principal(ActorType actorType) {
        return AuthPrincipal.builder().id("actor-1").actorType(actorType).build();
    }
}
