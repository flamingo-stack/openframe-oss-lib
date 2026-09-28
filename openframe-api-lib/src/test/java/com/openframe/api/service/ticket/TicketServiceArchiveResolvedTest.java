package com.openframe.api.service.ticket;

import com.openframe.api.dto.ticket.TicketFilterInput;
import com.openframe.api.service.AssignmentService;
import com.openframe.api.service.ticket.spi.TicketEventListener;
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

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Bulk archive is the one place where a status change is applied to many tickets at once. Whatever
 * the archiving itself does, the integrations hanging off the SPI (chat dialogs above all) must be
 * told about every archived id — otherwise their conversations stay open behind an archived board.
 */
@ExtendWith(MockitoExtension.class)
class TicketServiceArchiveResolvedTest {

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
    private final TicketFilterInput filter = TicketFilterInput.builder()
            .statusIds(List.of("st-resolved"))
            .build();

    @BeforeEach
    void registerListener() {
        listeners.add(listener);
    }

    @Test
    void archiveResolved_returnsCountAndNotifiesListeners() {
        List<String> archived = List.of("ticket-1", "ticket-2");
        when(ticketLifecycleService.archiveResolvedTickets(admin, filter)).thenReturn(archived);

        assertThat(service.archiveResolvedTickets(admin, filter)).isEqualTo(2);

        verify(listener).onTicketsArchived(archived, admin);
    }

    @Test
    void archiveResolved_nothingMatched_stillNotifiesWithAnEmptyList() {
        when(ticketLifecycleService.archiveResolvedTickets(admin, filter)).thenReturn(List.of());

        assertThat(service.archiveResolvedTickets(admin, filter)).isZero();

        verify(listener).onTicketsArchived(List.of(), admin);
    }

    @Test
    void archiveResolved_byNonAdmin_isRejectedBeforeAnyWork() {
        AuthPrincipal agent = principal(ActorType.AGENT);

        assertThatThrownBy(() -> service.archiveResolvedTickets(agent, filter))
                .isInstanceOf(IllegalStateException.class);

        verify(ticketLifecycleService, never()).archiveResolvedTickets(any(), any());
        verify(listener, never()).onTicketsArchived(any(), any());
    }

    private static AuthPrincipal principal(ActorType actorType) {
        return AuthPrincipal.builder().id("actor-1").actorType(actorType).build();
    }
}
