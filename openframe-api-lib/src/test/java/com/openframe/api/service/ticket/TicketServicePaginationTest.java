package com.openframe.api.service.ticket;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.service.AssignmentService;
import com.openframe.api.service.ticket.spi.TicketEventListener;
import com.openframe.data.document.ticket.Ticket;
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
import org.springframework.data.mongodb.core.query.Query;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The ticket list is cursor-paginated: one extra row is fetched to learn whether another page
 * exists, that row is trimmed off before it reaches the caller, and the cursors handed back are the
 * ids of the first and last row actually returned. Sorting falls back to the repository's default
 * whenever the caller's field is absent or unknown.
 */
@ExtendWith(MockitoExtension.class)
class TicketServicePaginationTest {

    private static final String DEFAULT_SORT_FIELD = "createdAt";

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
    void getTickets_asksForOneRowBeyondThePageAndTrimsIt() {
        givenPage(tickets(4));

        CountedGenericQueryResult<Ticket> result = service.getTickets(admin, null, paging(3, null), null, null);

        verify(ticketRepository).findTicketsWithCursor(any(), any(), eq(4), any(), any());
        assertThat(result.getItems()).extracting(Ticket::getId).containsExactly("t-0", "t-1", "t-2");
        assertThat(result.getPageInfo().isHasNextPage()).isTrue();
    }

    @Test
    void getTickets_onTheLastPage_reportsNoNextPage() {
        givenPage(tickets(2));

        CountedGenericQueryResult<Ticket> result = service.getTickets(admin, null, paging(3, null), null, null);

        assertThat(result.getItems()).hasSize(2);
        assertThat(result.getPageInfo().isHasNextPage()).isFalse();
    }

    /** A full page with nothing beyond it still counts as "there may be more" — the extra row decides. */
    @Test
    void getTickets_withExactlyAFullPage_reportsANextPage() {
        givenPage(tickets(3));

        CountedGenericQueryResult<Ticket> result = service.getTickets(admin, null, paging(3, null), null, null);

        assertThat(result.getItems()).hasSize(3);
        assertThat(result.getPageInfo().isHasNextPage()).isTrue();
    }

    @Test
    void getTickets_cursorsPointAtTheFirstAndLastReturnedRow() {
        givenPage(tickets(4));

        CountedGenericQueryResult<Ticket> result = service.getTickets(admin, null, paging(3, null), null, null);

        assertThat(result.getPageInfo().getStartCursor()).isEqualTo("t-0");
        assertThat(result.getPageInfo().getEndCursor()).isEqualTo("t-2");
    }

    @Test
    void getTickets_onAnEmptyPage_hasNoCursors() {
        givenPage(List.of());

        CountedGenericQueryResult<Ticket> result = service.getTickets(admin, null, paging(3, null), null, null);

        assertThat(result.getPageInfo().getStartCursor()).isNull();
        assertThat(result.getPageInfo().getEndCursor()).isNull();
        assertThat(result.getPageInfo().isHasNextPage()).isFalse();
    }

    @Test
    void getTickets_withACursor_reportsAPreviousPage() {
        givenPage(tickets(1));

        CountedGenericQueryResult<Ticket> result = service.getTickets(admin, null, paging(3, "t-9"), null, null);

        assertThat(result.getPageInfo().isHasPreviousPage()).isTrue();
    }

    @Test
    void getTickets_withoutACursor_reportsNoPreviousPage() {
        givenPage(tickets(1));

        CountedGenericQueryResult<Ticket> result = service.getTickets(admin, null, paging(3, null), null, null);

        assertThat(result.getPageInfo().isHasPreviousPage()).isFalse();
    }

    @Test
    void getTickets_reportsTheFilteredCountFromTheRepository() {
        givenPage(tickets(1));
        when(ticketRepository.countTickets(any())).thenReturn(37L);

        CountedGenericQueryResult<Ticket> result = service.getTickets(admin, null, paging(3, null), null, null);

        assertThat(result.getFilteredCount()).isEqualTo(37);
    }

    @Test
    void getTickets_withoutASort_usesTheRepositoryDefaultDescending() {
        givenPage(tickets(1));

        service.getTickets(admin, null, paging(3, null), null, null);

        verify(ticketRepository).findTicketsWithCursor(any(), any(), eq(4), eq(DEFAULT_SORT_FIELD), eq("DESC"));
    }

    @Test
    void getTickets_withAKnownSortField_usesIt() {
        givenPage(tickets(1));
        when(ticketRepository.isSortableField("title")).thenReturn(true);

        service.getTickets(admin, null, paging(3, null), null,
                SortInput.builder().field("title").direction(SortDirection.ASC).build());

        verify(ticketRepository).findTicketsWithCursor(any(), any(), eq(4), eq("title"), eq("ASC"));
    }

    @Test
    void getTickets_withAnUnknownSortField_fallsBackToTheDefault() {
        givenPage(tickets(1));
        when(ticketRepository.isSortableField("nonsense")).thenReturn(false);

        service.getTickets(admin, null, paging(3, null), null,
                SortInput.builder().field("nonsense").direction(SortDirection.ASC).build());

        verify(ticketRepository).findTicketsWithCursor(any(), any(), eq(4), eq(DEFAULT_SORT_FIELD), eq("ASC"));
    }

    @Test
    void getTickets_withABlankSortField_fallsBackToTheDefault() {
        givenPage(tickets(1));

        service.getTickets(admin, null, paging(3, null), null,
                SortInput.builder().field("   ").direction(SortDirection.ASC).build());

        verify(ticketRepository).findTicketsWithCursor(any(), any(), eq(4), eq(DEFAULT_SORT_FIELD), eq("ASC"));
    }

    private void givenPage(List<Ticket> page) {
        Query query = new Query();
        when(ticketRepository.buildTicketQuery(any(), any(), any(), any())).thenReturn(query);
        lenient().when(ticketRepository.getDefaultSortField()).thenReturn(DEFAULT_SORT_FIELD);
        when(ticketRepository.findTicketsWithCursor(eq(query), any(), org.mockito.ArgumentMatchers.anyInt(), any(), any()))
                .thenReturn(page);
    }

    private static CursorPaginationCriteria paging(int limit, String cursor) {
        return CursorPaginationCriteria.builder().limit(limit).cursor(cursor).build();
    }

    private static List<Ticket> tickets(int count) {
        return IntStream.range(0, count)
                .mapToObj(i -> Ticket.builder().id("t-" + i).build())
                .toList();
    }
}
