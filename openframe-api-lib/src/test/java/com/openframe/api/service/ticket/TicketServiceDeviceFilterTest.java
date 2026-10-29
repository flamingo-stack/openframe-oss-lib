package com.openframe.api.service.ticket;

import com.openframe.api.dto.ticket.TicketFilterInput;
import com.openframe.api.service.AssignmentService;
import com.openframe.data.document.ticket.filter.TicketQueryFilter;
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
import org.springframework.data.mongodb.core.query.Query;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The device axis of the ticket filter is a plain {@code deviceId} match, handed to the repository
 * as the caller sent it. It is the server-side replacement for the dashboard's device tab paging
 * through the whole tenant and matching tickets in the browser.
 */
@ExtendWith(MockitoExtension.class)
class TicketServiceDeviceFilterTest {

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

    private final Query query = new Query();

    private TicketService service;

    @BeforeEach
    void setUp() {
        service = new TicketService(ticketRepository, ticketNumberService, ticketTagService, ticketIdsForFilter,
                ticketStalenessResolver, machineRepository, organizationRepository, userRepository, assignmentService,
                ticketLifecycleService, ticketResolverStamp, List.of());
        when(ticketRepository.buildTicketQuery(any(), any(), any(), any())).thenReturn(query);
        when(ticketRepository.findTicketsWithCursor(eq(query), any(), anyInt(), any(), any())).thenReturn(List.of());
    }

    @Test
    void getTickets_forwardsDeviceIdsToTheQuery() {
        List<String> deviceIds = List.of("machine-1", "machine-2");

        service.getTickets(ADMIN, TicketFilterInput.builder().deviceIds(deviceIds).build(), null, null, null);

        assertThat(capturedFilter().getDeviceIds()).isEqualTo(deviceIds);
    }

    @Test
    void getTickets_deviceIdsRideAlongsideTheOtherAxes() {
        TicketFilterInput filter = TicketFilterInput.builder()
                .statusIds(List.of("st-tech"))
                .organizationIds(List.of("org-1"))
                .deviceIds(List.of("machine-1"))
                .assigneeIds(List.of("user-1"))
                .build();

        service.getTickets(ADMIN, filter, null, null, null);

        TicketQueryFilter captured = capturedFilter();
        assertThat(captured.getStatusIds()).containsExactly("st-tech");
        assertThat(captured.getOrganizationIds()).containsExactly("org-1");
        assertThat(captured.getDeviceIds()).containsExactly("machine-1");
        assertThat(captured.getAssigneeIds()).containsExactly("user-1");
    }

    @Test
    void getTickets_withoutDeviceIds_appliesNoDeviceNarrowing() {
        service.getTickets(ADMIN, TicketFilterInput.builder().statusIds(List.of("st-tech")).build(), null, null, null);

        assertThat(capturedFilter().getDeviceIds()).isNull();
    }

    private TicketQueryFilter capturedFilter() {
        ArgumentCaptor<TicketQueryFilter> captor = ArgumentCaptor.forClass(TicketQueryFilter.class);
        verify(ticketRepository).buildTicketQuery(captor.capture(), any(), any(), any());
        return captor.getValue();
    }
}
