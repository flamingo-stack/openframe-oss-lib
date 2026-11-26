package com.openframe.api.service.ticket;

import com.openframe.audit.AuditRecorder;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.dto.shared.PositionPaginationCriteria;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.service.AssignmentService;
import com.openframe.api.service.device.ClientOwnerScopeResolver;
import com.openframe.core.exception.InvalidCursorException;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.ticket.filter.TicketQueryFilter;
import com.openframe.data.model.ClientOwnerScope;
import com.openframe.data.repository.cursor.CursorPosition;
import com.openframe.data.repository.cursor.KeysetCursor;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.organization.OrganizationRepository;
import com.openframe.data.repository.ticket.TicketRepository;
import com.openframe.data.repository.user.UserRepository;
import com.openframe.security.authentication.ActorType;
import com.openframe.security.authentication.AuthPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.query.Query;

import java.time.Instant;
import java.util.List;
import java.util.stream.IntStream;
import java.util.stream.Stream;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.junit.jupiter.params.provider.Arguments.arguments;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TicketServiceGetTicketsTest {

    private static final AuthPrincipal ADMIN = AuthPrincipal.builder().id("admin-1").actorType(ActorType.ADMIN).build();
    private static final CursorPosition NO_POSITION = new CursorPosition.None();
    private static final String ID = "_id";
    private static final String UPDATED_AT = "updatedAt";
    private static final String TICKET_HEX = "65f1a2b3c4d5e6f708192a3b";
    private static final String OTHER_TICKET_HEX = "65f1a2b3c4d5e6f708192a3c";
    private static final Instant UPDATED_AT_VALUE = Instant.ofEpochMilli(1_700_000_000_123L);

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

    private final Query query = new Query();

    private TicketService ticketService;

    @BeforeEach
    void setUp() {
        ticketService = new TicketService(ticketRepository, ticketNumberService, ticketTagService, ticketIdsForFilter,
                ticketStalenessResolver, machineRepository, organizationRepository, userRepository, assignmentService,
                ticketLifecycleService, ticketResolverStamp, clientOwnerScopeResolver, List.of(), mock(AuditedMethodRunner.class, CALLS_REAL_METHODS), mock(AuditRecorder.class, CALLS_REAL_METHODS));
    }

    @ParameterizedTest
    @CsvSource({
            "3, 2, 2, true",
            "2, 2, 2, false",
            "1, 2, 1, false",
            "0, 2, 0, false"
    })
    void getTickets_rowsReturnedAgainstLimit_pageTrimmedAndNextPageFlagged(
            int returned, int limit, int expectedItems, boolean expectedHasNextPage) {
        stubQuery(null);
        when(ticketRepository.findTicketsWithCursor(eq(query), eq(NO_POSITION), eq(false), eq(limit + 1), isNull(), eq("DESC")))
                .thenReturn(tickets(returned));

        CountedGenericQueryResult<Ticket> result = ticketService.getTickets(ADMIN, null, page(limit, null), null, null);

        assertThat(result.getItems()).hasSize(expectedItems);
        assertThat(result.getPageInfo().isHasNextPage()).isEqualTo(expectedHasNextPage);
    }

    @Test
    void getTickets_moreRowsThanLimit_endCursorIsLastShownRowNotProbeRow() {
        stubQuery(null);
        when(ticketRepository.findTicketsWithCursor(eq(query), eq(NO_POSITION), eq(false), eq(3), isNull(), eq("DESC")))
                .thenReturn(tickets(3));

        CountedGenericQueryResult<Ticket> result = ticketService.getTickets(ADMIN, null, page(2, null), null, null);

        assertThat(result.getItems()).extracting(Ticket::getId).containsExactly("id-1", "id-2");
        assertThat(result.getPageInfo())
                .returns("id-1", PageInfo::getStartCursor)
                .returns("id-2", PageInfo::getEndCursor);
    }

    @Test
    void getTickets_noRows_noCursorsAndNoNextPage() {
        stubQuery(null);
        when(ticketRepository.findTicketsWithCursor(eq(query), eq(NO_POSITION), eq(false), eq(3), isNull(), eq("DESC")))
                .thenReturn(List.of());

        CountedGenericQueryResult<Ticket> result = ticketService.getTickets(ADMIN, null, page(2, null), null, null);

        assertThat(result.getItems()).isEmpty();
        assertThat(result.getPageInfo())
                .returns(false, PageInfo::isHasNextPage)
                .returns(null, PageInfo::getStartCursor)
                .returns(null, PageInfo::getEndCursor);
    }

    @Test
    void getTickets_nullPagination_fetchesDefaultPageSizePlusOne() {
        stubQuery(null);
        when(ticketRepository.findTicketsWithCursor(eq(query), eq(NO_POSITION), eq(false), eq(21), isNull(), eq("DESC")))
                .thenReturn(tickets(21));

        CountedGenericQueryResult<Ticket> result = ticketService.getTickets(ADMIN, null, null, null, null);

        assertThat(result.getItems()).hasSize(20);
        assertThat(result.getPageInfo().isHasNextPage()).isTrue();
    }

    @Test
    void getTickets_cursorGiven_hasPreviousPage() {
        stubQuery(null);
        CursorPosition afterRow = new CursorPosition.RowId("id-0");
        when(ticketRepository.findTicketsWithCursor(eq(query), eq(afterRow), eq(false), eq(3), isNull(), eq("DESC")))
                .thenReturn(tickets(1));

        CountedGenericQueryResult<Ticket> result = ticketService.getTickets(ADMIN, null, page(2, "id-0"), null, null);

        assertThat(result.getPageInfo().isHasPreviousPage()).isTrue();
    }

    @Test
    void getTickets_agentPrincipal_queryScopedToOwnMachine() {
        AuthPrincipal agent = AuthPrincipal.builder().machineId("machine-1").actorType(ActorType.AGENT).build();
        stubQuery(new ClientOwnerScope("machine-1", "org-b", null));
        when(ticketRepository.findTicketsWithCursor(eq(query), eq(NO_POSITION), eq(false), eq(3), isNull(), eq("DESC")))
                .thenReturn(tickets(1));

        CountedGenericQueryResult<Ticket> result = ticketService.getTickets(agent, null, page(2, null), null, null);

        assertThat(result.getItems()).extracting(Ticket::getId).containsExactly("id-1");
    }

    @Test
    void getTickets_rawTicketIdCursor_rowIdPositionInAndRawTicketIdsOut() {
        // setup
        stubQuery(null);
        CursorPosition afterRow = new CursorPosition.RowId(TICKET_HEX);
        when(ticketRepository.findTicketsWithCursor(eq(query), eq(afterRow), eq(false), eq(3), isNull(), eq("DESC")))
                .thenReturn(tickets(3));

        // execution
        CountedGenericQueryResult<Ticket> result =
                ticketService.getTickets(ADMIN, null, page(2, TICKET_HEX), null, null);

        // verifications
        assertThat(result.getItems()).extracting(Ticket::getId).containsExactly("id-1", "id-2");
        assertThat(result.getPageInfo())
                .returns("id-1", PageInfo::getStartCursor)
                .returns("id-2", PageInfo::getEndCursor)
                .returns(true, PageInfo::isHasNextPage)
                .returns(true, PageInfo::isHasPreviousPage);
        verify(ticketRepository, never()).keysetCursor(any(Ticket.class), nullable(String.class), nullable(String.class));
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " "})
    void getTickets_noCursorText_firstPage(String cursor) {
        // setup
        stubQuery(null);
        when(ticketRepository.findTicketsWithCursor(eq(query), eq(NO_POSITION), eq(false), eq(3), isNull(), eq("DESC")))
                .thenReturn(tickets(1));

        // execution
        CountedGenericQueryResult<Ticket> result = ticketService.getTickets(ADMIN, null, page(2, cursor), null, null);

        // verifications
        assertThat(result.getItems()).extracting(Ticket::getId).containsExactly("id-1");
        assertThat(result.getPageInfo().isHasPreviousPage()).isFalse();
    }

    @Test
    void getTickets_backwardBeforeARawTicketId_fetchedAgainstTheDisplayOrderAndReadBack() {
        // setup
        stubQuery(null);
        CursorPosition beforeRow = new CursorPosition.RowId(TICKET_HEX);
        CursorPaginationCriteria lastTwoBefore = CursorPaginationCriteria.builder()
                .limit(2).cursor(TICKET_HEX).backward(true).build();
        when(ticketRepository.findTicketsWithCursor(eq(query), eq(beforeRow), eq(true), eq(3), isNull(), eq("DESC")))
                .thenReturn(tickets(3));

        // execution
        CountedGenericQueryResult<Ticket> result = ticketService.getTickets(ADMIN, null, lastTwoBefore, null, null);

        // verifications
        assertThat(result.getItems()).extracting(Ticket::getId).containsExactly("id-2", "id-1");
        assertThat(result.getPageInfo())
                .returns("id-2", PageInfo::getStartCursor)
                .returns("id-1", PageInfo::getEndCursor)
                .returns(true, PageInfo::isHasNextPage)
                .returns(true, PageInfo::isHasPreviousPage);
    }

    @Test
    void getTickets_backwardWithoutACursor_lastRowsInDisplayOrderAndNoNextPage() {
        // setup
        stubQuery(null);
        CursorPaginationCriteria lastTwo = CursorPaginationCriteria.builder().limit(2).backward(true).build();
        when(ticketRepository.findTicketsWithCursor(eq(query), eq(NO_POSITION), eq(true), eq(3), isNull(), eq("DESC")))
                .thenReturn(tickets(2));

        // execution
        CountedGenericQueryResult<Ticket> result = ticketService.getTickets(ADMIN, null, lastTwo, null, null);

        // verifications
        assertThat(result.getItems()).extracting(Ticket::getId).containsExactly("id-2", "id-1");
        assertThat(result.getPageInfo())
                .returns(false, PageInfo::isHasNextPage)
                .returns(false, PageInfo::isHasPreviousPage);
    }

    @Test
    void getTicketsByPosition_keysetPositionBackward_repositoryGetsThePositionAndTheDirection() {
        // setup
        stubQuery(null);
        SortInput byUpdatedAt = SortInput.builder().field(UPDATED_AT).direction(SortDirection.ASC).build();
        KeysetCursor cursor = KeysetCursor.ofInstant(UPDATED_AT, Sort.Direction.ASC, UPDATED_AT_VALUE, TICKET_HEX);
        PositionPaginationCriteria lastTwoBefore = PositionPaginationCriteria.builder()
                .position(cursor).limit(2).backward(true).build();
        when(ticketRepository.isSortableField(UPDATED_AT)).thenReturn(true);

        // execution
        ticketService.getTicketsByPosition(ADMIN, null, lastTwoBefore, null, byUpdatedAt);

        // verifications
        verify(ticketRepository).findTicketsWithCursor(query, cursor, true, 3, UPDATED_AT, "ASC");
    }

    @Test
    void getTicketsByPosition_rowIdPosition_passedOnAsItIs() {
        // setup
        stubQuery(null);
        CursorPosition afterRow = new CursorPosition.RowId(TICKET_HEX);
        PositionPaginationCriteria firstTwoAfter = PositionPaginationCriteria.builder()
                .position(afterRow).limit(2).build();
        when(ticketRepository.getDefaultSortField()).thenReturn(ID);

        // execution
        ticketService.getTicketsByPosition(ADMIN, null, firstTwoAfter, null, null);

        // verifications
        verify(ticketRepository).findTicketsWithCursor(query, afterRow, false, 3, ID, "DESC");
    }

    @Test
    void getTicketsByPosition_moreRowsThanLimit_pageInfoCursorsAreTheEncodedKeysetsOfTheFirstAndLastShownRows() {
        // setup
        stubQuery(null);
        List<Ticket> fetched = tickets(3);
        Ticket firstShown = fetched.getFirst();
        Ticket lastShown = fetched.get(1);
        KeysetCursor startKeyset = new KeysetCursor(ID, Sort.Direction.DESC, "", TICKET_HEX);
        KeysetCursor endKeyset = new KeysetCursor(ID, Sort.Direction.DESC, "", OTHER_TICKET_HEX);
        PositionPaginationCriteria firstTwo = PositionPaginationCriteria.builder().limit(2).build();
        when(ticketRepository.getDefaultSortField()).thenReturn(ID);
        when(ticketRepository.findTicketsWithCursor(query, NO_POSITION, false, 3, ID, "DESC")).thenReturn(fetched);
        when(ticketRepository.keysetCursor(firstShown, ID, "DESC")).thenReturn(startKeyset);
        when(ticketRepository.keysetCursor(lastShown, ID, "DESC")).thenReturn(endKeyset);

        // execution
        CountedGenericQueryResult<Ticket> result =
                ticketService.getTicketsByPosition(ADMIN, null, firstTwo, null, null);

        // verifications
        assertThat(result.getItems()).extracting(Ticket::getId).containsExactly("id-1", "id-2");
        assertThat(result.getPageInfo())
                .returns(startKeyset.encode(), PageInfo::getStartCursor)
                .returns(endKeyset.encode(), PageInfo::getEndCursor);
        assertThat(KeysetCursor.parse(result.getPageInfo().getStartCursor())).isEqualTo(startKeyset);
        assertThat(KeysetCursor.parse(result.getPageInfo().getEndCursor())).isEqualTo(endKeyset);
    }

    @Test
    void getTicketsByPosition_unknownSortField_cursorsIssuedUnderTheDefaultSort() {
        // setup
        stubQuery(null);
        List<Ticket> fetched = tickets(1);
        Ticket onlyRow = fetched.getFirst();
        SortInput unknownSort = SortInput.builder().field("nonsense").direction(SortDirection.ASC).build();
        KeysetCursor keyset = new KeysetCursor(ID, Sort.Direction.ASC, "", TICKET_HEX);
        PositionPaginationCriteria firstTwo = PositionPaginationCriteria.builder().limit(2).build();
        when(ticketRepository.isSortableField("nonsense")).thenReturn(false);
        when(ticketRepository.getDefaultSortField()).thenReturn(ID);
        when(ticketRepository.findTicketsWithCursor(query, NO_POSITION, false, 3, ID, "ASC")).thenReturn(fetched);
        when(ticketRepository.keysetCursor(onlyRow, ID, "ASC")).thenReturn(keyset);

        // execution
        CountedGenericQueryResult<Ticket> result =
                ticketService.getTicketsByPosition(ADMIN, null, firstTwo, null, unknownSort);

        // verifications
        assertThat(result.getPageInfo())
                .returns(keyset.encode(), PageInfo::getStartCursor)
                .returns(keyset.encode(), PageInfo::getEndCursor);
    }

    @Test
    void getTicketsByPosition_noRows_noCursorsAndNoPages() {
        // setup
        stubQuery(null);
        PositionPaginationCriteria firstTwo = PositionPaginationCriteria.builder().limit(2).build();
        when(ticketRepository.getDefaultSortField()).thenReturn(ID);
        when(ticketRepository.findTicketsWithCursor(query, NO_POSITION, false, 3, ID, "DESC")).thenReturn(List.of());

        // execution
        CountedGenericQueryResult<Ticket> result =
                ticketService.getTicketsByPosition(ADMIN, null, firstTwo, null, null);

        // verifications
        assertThat(result.getItems()).isEmpty();
        assertThat(result.getPageInfo())
                .returns(false, PageInfo::isHasNextPage)
                .returns(false, PageInfo::isHasPreviousPage)
                .returns(null, PageInfo::getStartCursor)
                .returns(null, PageInfo::getEndCursor);
    }

    @Test
    void getTicketsByPosition_nullPagination_firstPageOfTheDefaultSize() {
        // setup
        stubQuery(null);
        when(ticketRepository.getDefaultSortField()).thenReturn(ID);

        // execution
        ticketService.getTicketsByPosition(ADMIN, null, null, null, null);

        // verifications
        verify(ticketRepository).findTicketsWithCursor(query, NO_POSITION, false, 21, ID, "DESC");
    }

    @ParameterizedTest
    @MethodSource("positionsAndDirectionsAgainstRowsReturned")
    void getTicketsByPosition_positionAndDirectionAgainstRowsReturned_bothFlags(
            CursorPosition position, boolean backward, int returned,
            boolean expectedHasPreviousPage, boolean expectedHasNextPage) {
        // setup
        stubQuery(null);
        PositionPaginationCriteria pagination = PositionPaginationCriteria.builder()
                .position(position).limit(2).backward(backward).build();
        KeysetCursor keyset = new KeysetCursor(ID, Sort.Direction.DESC, "", TICKET_HEX);
        when(ticketRepository.getDefaultSortField()).thenReturn(ID);
        when(ticketRepository.findTicketsWithCursor(query, position, backward, 3, ID, "DESC"))
                .thenReturn(tickets(returned));
        when(ticketRepository.keysetCursor(any(Ticket.class), eq(ID), eq("DESC"))).thenReturn(keyset);

        // execution
        CountedGenericQueryResult<Ticket> result =
                ticketService.getTicketsByPosition(ADMIN, null, pagination, null, null);

        // verifications
        assertThat(result.getPageInfo())
                .returns(expectedHasPreviousPage, PageInfo::isHasPreviousPage)
                .returns(expectedHasNextPage, PageInfo::isHasNextPage);
    }

    @Test
    void getTicketsByPosition_backward_rowsReadBackInDisplayOrder() {
        // setup
        stubQuery(null);
        CursorPosition beforeRow = new CursorPosition.RowId(TICKET_HEX);
        PositionPaginationCriteria lastTwoBefore = PositionPaginationCriteria.builder()
                .position(beforeRow).limit(2).backward(true).build();
        KeysetCursor keyset = new KeysetCursor(ID, Sort.Direction.DESC, "", TICKET_HEX);
        when(ticketRepository.getDefaultSortField()).thenReturn(ID);
        when(ticketRepository.findTicketsWithCursor(query, beforeRow, true, 3, ID, "DESC")).thenReturn(tickets(3));
        when(ticketRepository.keysetCursor(any(Ticket.class), eq(ID), eq("DESC"))).thenReturn(keyset);

        // execution
        CountedGenericQueryResult<Ticket> result =
                ticketService.getTicketsByPosition(ADMIN, null, lastTwoBefore, null, null);

        // verifications
        assertThat(result.getItems()).extracting(Ticket::getId).containsExactly("id-2", "id-1");
    }

    @Test
    void getTicketsByPosition_positionGiven_filteredCountIsTheCountOfTheWholeFilter() {
        // setup
        stubQuery(null);
        CursorPosition afterRow = new CursorPosition.RowId(TICKET_HEX);
        PositionPaginationCriteria firstTwoAfter = PositionPaginationCriteria.builder()
                .position(afterRow).limit(2).build();
        when(ticketRepository.getDefaultSortField()).thenReturn(ID);
        when(ticketRepository.countTickets(query)).thenReturn(37L);

        // execution
        CountedGenericQueryResult<Ticket> result =
                ticketService.getTicketsByPosition(ADMIN, null, firstTwoAfter, null, null);

        // verifications
        assertThat(result.getFilteredCount()).isEqualTo(37);
    }

    @Test
    void getTicketsByPosition_repositoryRejectsThePosition_invalidCursorReachesTheCaller() {
        // setup
        stubQuery(null);
        CursorPosition unrecognised = new CursorPosition.Unrecognised("not-a-ticket-cursor");
        PositionPaginationCriteria pagination = PositionPaginationCriteria.builder()
                .position(unrecognised).limit(2).build();
        when(ticketRepository.getDefaultSortField()).thenReturn(ID);
        when(ticketRepository.findTicketsWithCursor(query, unrecognised, false, 3, ID, "DESC"))
                .thenThrow(new InvalidCursorException());

        // execution
        Throwable thrown = catchThrowable(() -> ticketService.getTicketsByPosition(ADMIN, null, pagination, null, null));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage("Invalid cursor");
    }

    @Test
    void getTicketsByPosition_agentPrincipal_queryScopedToOwnMachine() {
        // setup
        AuthPrincipal agent = AuthPrincipal.builder().machineId("machine-1").actorType(ActorType.AGENT).build();
        ClientOwnerScope ownerScope = new ClientOwnerScope("machine-1", "org-b", null);
        PositionPaginationCriteria firstTwo = PositionPaginationCriteria.builder().limit(2).build();
        stubQuery(ownerScope);
        when(ticketRepository.getDefaultSortField()).thenReturn(ID);

        // execution
        ticketService.getTicketsByPosition(agent, null, firstTwo, null, null);

        // verifications
        verify(ticketRepository).findTicketsWithCursor(query, NO_POSITION, false, 3, ID, "DESC");
    }

    private void stubQuery(ClientOwnerScope ownerScope) {
        when(clientOwnerScopeResolver.isOwnerScoped(any())).thenReturn(ownerScope != null);
        if (ownerScope != null) {
            when(clientOwnerScopeResolver.scopeOf(any())).thenReturn(ownerScope);
        }
        when(ticketRepository.buildTicketQuery(any(TicketQueryFilter.class), isNull(), eq(List.of()), eq(ownerScope)))
                .thenReturn(query);
    }

    private static Stream<Arguments> positionsAndDirectionsAgainstRowsReturned() {
        CursorPosition rowId = new CursorPosition.RowId(TICKET_HEX);
        CursorPosition keyset = new KeysetCursor(ID, Sort.Direction.DESC, "", TICKET_HEX);
        return Stream.of(
                arguments(NO_POSITION, false, 3, false, true),
                arguments(NO_POSITION, false, 2, false, false),
                arguments(rowId, false, 3, true, true),
                arguments(keyset, false, 3, true, true),
                arguments(keyset, false, 1, true, false),
                arguments(NO_POSITION, true, 3, true, false),
                arguments(NO_POSITION, true, 2, false, false),
                arguments(rowId, true, 3, true, true),
                arguments(keyset, true, 3, true, true),
                arguments(keyset, true, 1, false, true));
    }

    private static CursorPaginationCriteria page(int limit, String cursor) {
        return CursorPaginationCriteria.builder().limit(limit).cursor(cursor).build();
    }

    private static List<Ticket> tickets(int count) {
        return IntStream.rangeClosed(1, count).mapToObj(i -> Ticket.builder().id("id-" + i).build()).toList();
    }
}
