package com.openframe.api.service.ticket;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.dto.shared.PositionPaginationCriteria;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.service.AssignmentService;
import com.openframe.api.service.device.ClientOwnerScopeResolver;
import com.openframe.api.service.ticket.spi.TicketEventListener;
import com.openframe.core.exception.InvalidCursorException;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.mongo.TenantAwareMongoTemplate;
import com.openframe.data.repository.cursor.CursorBase64;
import com.openframe.data.repository.cursor.CursorPosition;
import com.openframe.data.repository.cursor.KeysetCursor;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.organization.OrganizationRepository;
import com.openframe.data.repository.ticket.CustomTicketRepository;
import com.openframe.data.repository.ticket.CustomTicketRepositoryImpl;
import com.openframe.data.repository.ticket.TicketRepository;
import com.openframe.data.repository.user.UserRepository;
import com.openframe.security.authentication.ActorType;
import com.openframe.security.authentication.AuthPrincipal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.query.Query;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.stream.IntStream;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.junit.jupiter.params.provider.Arguments.arguments;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
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
    private static final String ID = "_id";
    private static final String TICKET_NUMBER = "ticketNumber";
    private static final String ASSIGNED_NAME = "assignedName";
    private static final String UPDATED_AT = "updatedAt";
    private static final String KEYSET_PREFIX = "k1|";
    private static final String ROW_1 = "65f1a2b3c4d5e6f708192a10";
    private static final String ROW_2 = "65f1a2b3c4d5e6f708192a20";
    private static final String ROW_3 = "65f1a2b3c4d5e6f708192a30";
    private static final String ROW_4 = "65f1a2b3c4d5e6f708192a40";
    private static final String ROW_5 = "65f1a2b3c4d5e6f708192a50";
    private static final String GONE_ROW = "65f1a2b3c4d5e6f708192a35";
    private static final Instant EARLY = Instant.ofEpochMilli(1_700_000_000_000L);
    private static final Instant MIDDLE = EARLY.plusSeconds(60);
    private static final Instant LATE = EARLY.plusSeconds(120);
    private static final CursorPosition NO_POSITION = new CursorPosition.None();

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

    @Spy private List<TicketEventListener> listeners = new ArrayList<>();

    @InjectMocks private TicketService service;

    private final AuthPrincipal admin = AuthPrincipal.builder()
            .id("admin-1")
            .actorType(ActorType.ADMIN)
            .build();

    @SuppressWarnings("unchecked")
    private final CustomTicketRepository cursorIssuer = new CustomTicketRepositoryImpl(
            mock(TenantAwareMongoTemplate.class), mock(ObjectProvider.class), mock(ObjectProvider.class));

    @Test
    void getTickets_asksForOneRowBeyondThePageAndTrimsIt() {
        givenPage(tickets(4));

        CountedGenericQueryResult<Ticket> result = service.getTickets(admin, null, paging(3, null), null, null);

        verify(ticketRepository).findTicketsWithCursor(any(), any(), anyBoolean(), eq(4), any(), any());
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

    /** The extra row is what proves another page exists: a full page without it is the last one. */
    @Test
    void getTickets_withExactlyAFullPage_reportsNoNextPage() {
        givenPage(tickets(3));

        CountedGenericQueryResult<Ticket> result = service.getTickets(admin, null, paging(3, null), null, null);

        assertThat(result.getItems()).hasSize(3);
        assertThat(result.getPageInfo().isHasNextPage()).isFalse();
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

        verify(ticketRepository).findTicketsWithCursor(any(), any(), anyBoolean(), eq(4), eq(DEFAULT_SORT_FIELD), eq("DESC"));
    }

    @Test
    void getTickets_withAKnownSortField_usesIt() {
        givenPage(tickets(1));
        when(ticketRepository.isSortableField("title")).thenReturn(true);

        service.getTickets(admin, null, paging(3, null), null,
                SortInput.builder().field("title").direction(SortDirection.ASC).build());

        verify(ticketRepository).findTicketsWithCursor(any(), any(), anyBoolean(), eq(4), eq("title"), eq("ASC"));
    }

    @Test
    void getTickets_withAnUnknownSortField_fallsBackToTheDefault() {
        givenPage(tickets(1));
        when(ticketRepository.isSortableField("nonsense")).thenReturn(false);

        service.getTickets(admin, null, paging(3, null), null,
                SortInput.builder().field("nonsense").direction(SortDirection.ASC).build());

        verify(ticketRepository).findTicketsWithCursor(any(), any(), anyBoolean(), eq(4), eq(DEFAULT_SORT_FIELD), eq("ASC"));
    }

    @Test
    void getTickets_withABlankSortField_fallsBackToTheDefault() {
        givenPage(tickets(1));

        service.getTickets(admin, null, paging(3, null), null,
                SortInput.builder().field("   ").direction(SortDirection.ASC).build());

        verify(ticketRepository).findTicketsWithCursor(any(), any(), anyBoolean(), eq(4), eq(DEFAULT_SORT_FIELD), eq("ASC"));
    }

    @ParameterizedTest
    @MethodSource("sortsOverRowsWithNullsAndEqualValues")
    void getTicketsByPosition_pageOneThenPageTwoThenBeforePageTwo_returnsPageOneAgain(
            SortInput sort, List<String> pageOneRows, List<String> pageTwoRows) {
        // setup
        stubTicketPages(sort);

        // execution
        CountedGenericQueryResult<Ticket> pageOne = service.getTicketsByPosition(admin, null, first(2), null, sort);
        CountedGenericQueryResult<Ticket> pageTwo = service.getTicketsByPosition(
                admin, null, firstAfter(2, pageOne.getPageInfo().getEndCursor()), null, sort);
        CountedGenericQueryResult<Ticket> backToPageOne = service.getTicketsByPosition(
                admin, null, lastBefore(2, pageTwo.getPageInfo().getStartCursor()), null, sort);

        // verifications
        assertThat(pageOne.getItems()).extracting(Ticket::getId).containsExactlyElementsOf(pageOneRows);
        assertThat(pageTwo.getItems()).extracting(Ticket::getId).containsExactlyElementsOf(pageTwoRows);
        assertThat(backToPageOne.getItems()).extracting(Ticket::getId).containsExactlyElementsOf(pageOneRows);
        assertThat(backToPageOne.getPageInfo())
                .returns(pageOne.getPageInfo().getStartCursor(), PageInfo::getStartCursor)
                .returns(pageOne.getPageInfo().getEndCursor(), PageInfo::getEndCursor);
    }

    @ParameterizedTest
    @MethodSource("threePagesPerSort")
    void getTicketsByPosition_threePagesForwardThenBackFromTheLast_everyRowOnceInDisplayOrder(
            SortInput sort, List<String> pageOneRows, List<String> pageTwoRows, List<String> pageThreeRows) {
        // setup
        stubTicketPages(sort);

        // execution
        CountedGenericQueryResult<Ticket> pageOne = service.getTicketsByPosition(admin, null, first(2), null, sort);
        CountedGenericQueryResult<Ticket> pageTwo = service.getTicketsByPosition(
                admin, null, firstAfter(2, pageOne.getPageInfo().getEndCursor()), null, sort);
        CountedGenericQueryResult<Ticket> pageThree = service.getTicketsByPosition(
                admin, null, firstAfter(2, pageTwo.getPageInfo().getEndCursor()), null, sort);
        CountedGenericQueryResult<Ticket> backToPageTwo = service.getTicketsByPosition(
                admin, null, lastBefore(2, pageThree.getPageInfo().getStartCursor()), null, sort);
        CountedGenericQueryResult<Ticket> backToPageOne = service.getTicketsByPosition(
                admin, null, lastBefore(2, backToPageTwo.getPageInfo().getStartCursor()), null, sort);

        // verifications
        assertThat(pageOne.getItems()).extracting(Ticket::getId).containsExactlyElementsOf(pageOneRows);
        assertThat(pageTwo.getItems()).extracting(Ticket::getId).containsExactlyElementsOf(pageTwoRows);
        assertThat(pageThree.getItems()).extracting(Ticket::getId).containsExactlyElementsOf(pageThreeRows);
        assertThat(backToPageTwo.getItems()).extracting(Ticket::getId).containsExactlyElementsOf(pageTwoRows);
        assertThat(backToPageOne.getItems()).extracting(Ticket::getId).containsExactlyElementsOf(pageOneRows);
        assertThat(pageThree.getPageInfo())
                .returns(true, PageInfo::isHasPreviousPage)
                .returns(false, PageInfo::isHasNextPage);
        assertThat(backToPageTwo.getPageInfo())
                .returns(true, PageInfo::isHasPreviousPage)
                .returns(true, PageInfo::isHasNextPage);
        assertThat(backToPageOne.getPageInfo())
                .returns(false, PageInfo::isHasPreviousPage)
                .returns(true, PageInfo::isHasNextPage);
    }

    @ParameterizedTest
    @MethodSource("pagesOfFiveRows")
    void getTicketsByPosition_eachPageInEachDirection_rowsInDisplayOrderWithBothFlags(
            boolean backward, int anchorRow, List<String> expectedRows, boolean hasPreviousPage, boolean hasNextPage) {
        // setup
        SortInput sort = sortBy(TICKET_NUMBER, SortDirection.ASC);
        stubTicketPages(sort);
        CursorPosition position = ticketNumberPositionOfRow(anchorRow);
        PositionPaginationCriteria pagination = PositionPaginationCriteria.builder()
                .position(position).limit(2).backward(backward).build();

        // execution
        CountedGenericQueryResult<Ticket> result = service.getTicketsByPosition(admin, null, pagination, null, sort);

        // verifications
        assertThat(result.getItems()).extracting(Ticket::getId).containsExactlyElementsOf(expectedRows);
        assertThat(result.getPageInfo())
                .returns(hasPreviousPage, PageInfo::isHasPreviousPage)
                .returns(hasNextPage, PageInfo::isHasNextPage);
    }

    @Test
    void getTicketsByPosition_lastWithoutBefore_lastRowsInDisplayOrderAndNoNextPage() {
        // setup
        SortInput sort = sortBy(ASSIGNED_NAME, SortDirection.ASC);
        stubTicketPages(sort);
        PositionPaginationCriteria lastTwo = PositionPaginationCriteria.builder().limit(2).backward(true).build();

        // execution
        CountedGenericQueryResult<Ticket> result = service.getTicketsByPosition(admin, null, lastTwo, null, sort);

        // verifications
        assertThat(result.getItems()).extracting(Ticket::getId).containsExactly(ROW_3, ROW_5);
        assertThat(result.getPageInfo())
                .returns(false, PageInfo::isHasNextPage)
                .returns(true, PageInfo::isHasPreviousPage);
        verify(ticketRepository).findTicketsWithCursor(any(Query.class), eq(NO_POSITION), eq(true), eq(3),
                eq(ASSIGNED_NAME), eq("ASC"));
    }

    @ParameterizedTest
    @MethodSource("keysetsOfTheFirstTwoRows")
    void getTicketsByPosition_pageInfoCursors_keysetCursorsOfTheFirstAndLastShownRowsThatParseBack(
            SortInput sort, KeysetCursor expectedStart, KeysetCursor expectedEnd) {
        // setup
        stubTicketPages(sort);

        // execution
        PageInfo pageInfo = service.getTicketsByPosition(admin, null, first(2), null, sort).getPageInfo();

        // verifications
        assertThat(KeysetCursor.parse(pageInfo.getStartCursor())).isEqualTo(expectedStart);
        assertThat(KeysetCursor.parse(pageInfo.getEndCursor())).isEqualTo(expectedEnd);
        assertThat(CursorBase64.decode(pageInfo.getStartCursor())).startsWith(KEYSET_PREFIX);
        assertThat(CursorBase64.decode(pageInfo.getEndCursor())).startsWith(KEYSET_PREFIX);
    }

    @Test
    void getTicketsByPosition_rawTicketIdOfAnOlderClientWhoseRowIsGoneUnderTheDefaultSort_pagesOnFromThatPosition() {
        // setup
        stubTicketPages(null);
        CursorPosition olderClientCursor = KeysetCursor.parse(GONE_ROW);
        PositionPaginationCriteria firstTwoAfter = PositionPaginationCriteria.builder()
                .position(olderClientCursor).limit(2).build();

        // execution
        CountedGenericQueryResult<Ticket> result = service.getTicketsByPosition(admin, null, firstTwoAfter, null, null);

        // verifications
        assertThat(result.getItems()).extracting(Ticket::getId).containsExactly(ROW_3, ROW_2);
        assertThat(result.getPageInfo())
                .returns(true, PageInfo::isHasNextPage)
                .returns(true, PageInfo::isHasPreviousPage);
        assertThat(KeysetCursor.parse(result.getPageInfo().getEndCursor()))
                .isEqualTo(new KeysetCursor(ID, Sort.Direction.DESC, "", ROW_2));
    }

    @Test
    void getTicketsByPosition_rawTicketIdOfAnOlderClientUnderAValueSort_pagesPastThatRowsCurrentValue() {
        // setup
        SortInput sort = sortBy(ASSIGNED_NAME, SortDirection.ASC);
        stubTicketPages(sort);
        CursorPosition olderClientCursor = KeysetCursor.parse(ROW_4);
        PositionPaginationCriteria firstTwoAfter = PositionPaginationCriteria.builder()
                .position(olderClientCursor).limit(2).build();

        // execution
        CountedGenericQueryResult<Ticket> result = service.getTicketsByPosition(admin, null, firstTwoAfter, null, sort);

        // verifications
        assertThat(result.getItems()).extracting(Ticket::getId).containsExactly(ROW_2, ROW_3);
    }

    @ParameterizedTest
    @MethodSource("rawIdPagesPerSort")
    void getTickets_rawIdPageOneThenPageTwoThenBeforePageTwo_rawTicketIdsInAndOut(
            SortInput sort, List<String> pageOneRows, List<String> pageTwoRows) {
        // setup
        stubTicketPages(sort);
        String startOfPageOne = pageOneRows.getFirst();
        String endOfPageOne = pageOneRows.getLast();
        String startOfPageTwo = pageTwoRows.getFirst();
        String endOfPageTwo = pageTwoRows.getLast();

        // execution
        CountedGenericQueryResult<Ticket> pageOne = service.getTickets(admin, null, paging(2, null), null, sort);
        CountedGenericQueryResult<Ticket> pageTwo = service.getTickets(
                admin, null, paging(2, pageOne.getPageInfo().getEndCursor()), null, sort);
        CountedGenericQueryResult<Ticket> backToPageOne = service.getTickets(
                admin, null, pagingBackward(2, pageTwo.getPageInfo().getStartCursor()), null, sort);

        // verifications
        assertThat(pageOne.getItems()).extracting(Ticket::getId).containsExactlyElementsOf(pageOneRows);
        assertThat(pageTwo.getItems()).extracting(Ticket::getId).containsExactlyElementsOf(pageTwoRows);
        assertThat(backToPageOne.getItems()).extracting(Ticket::getId).containsExactlyElementsOf(pageOneRows);
        assertThat(pageOne.getPageInfo())
                .returns(startOfPageOne, PageInfo::getStartCursor)
                .returns(endOfPageOne, PageInfo::getEndCursor);
        assertThat(pageTwo.getPageInfo())
                .returns(startOfPageTwo, PageInfo::getStartCursor)
                .returns(endOfPageTwo, PageInfo::getEndCursor);
        assertThat(backToPageOne.getPageInfo())
                .returns(startOfPageOne, PageInfo::getStartCursor)
                .returns(endOfPageOne, PageInfo::getEndCursor);
        verify(ticketRepository, never()).keysetCursor(any(Ticket.class), any(String.class), any(String.class));
    }

    @Test
    void getTickets_rawTicketIdWhoseRowIsGoneUnderTheDefaultSort_pagesOnFromThatPosition() {
        // setup
        stubTicketPages(null);

        // execution
        CountedGenericQueryResult<Ticket> result = service.getTickets(admin, null, paging(2, GONE_ROW), null, null);

        // verifications
        assertThat(result.getItems()).extracting(Ticket::getId).containsExactly(ROW_3, ROW_2);
        assertThat(result.getPageInfo())
                .returns(ROW_3, PageInfo::getStartCursor)
                .returns(ROW_2, PageInfo::getEndCursor)
                .returns(true, PageInfo::isHasNextPage)
                .returns(true, PageInfo::isHasPreviousPage);
    }

    @Test
    void getTickets_rawTicketIdWhoseRowIsGoneUnderAValueSort_invalidCursorOfTheRepositoryReachesTheCaller() {
        // setup
        SortInput sort = sortBy(UPDATED_AT, SortDirection.DESC);
        stubTicketPages(sort);
        CursorPaginationCriteria afterGoneRow = paging(2, GONE_ROW);

        // execution
        Throwable thrown = catchThrowable(() -> service.getTickets(admin, null, afterGoneRow, null, sort));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage("Invalid cursor");
    }

    private void givenPage(List<Ticket> page) {
        Query query = new Query();
        when(ticketRepository.buildTicketQuery(any(), any(), any(), any())).thenReturn(query);
        lenient().when(ticketRepository.getDefaultSortField()).thenReturn(DEFAULT_SORT_FIELD);
        when(ticketRepository.findTicketsWithCursor(eq(query), any(), anyBoolean(), anyInt(), any(), any()))
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

    private static Stream<Arguments> sortsOverRowsWithNullsAndEqualValues() {
        return Stream.of(
                arguments(null, List.of(ROW_5, ROW_4), List.of(ROW_3, ROW_2)),
                arguments(sortBy(ID, SortDirection.ASC), List.of(ROW_1, ROW_2), List.of(ROW_3, ROW_4)),
                arguments(sortBy(UPDATED_AT, SortDirection.ASC), List.of(ROW_5, ROW_2), List.of(ROW_3, ROW_4)),
                arguments(sortBy(UPDATED_AT, SortDirection.DESC), List.of(ROW_1, ROW_4), List.of(ROW_3, ROW_2)),
                arguments(sortBy(TICKET_NUMBER, SortDirection.ASC), List.of(ROW_1, ROW_2), List.of(ROW_3, ROW_4)),
                arguments(sortBy(TICKET_NUMBER, SortDirection.DESC), List.of(ROW_5, ROW_4), List.of(ROW_3, ROW_2)),
                arguments(sortBy(ASSIGNED_NAME, SortDirection.ASC), List.of(ROW_1, ROW_4), List.of(ROW_2, ROW_3)),
                arguments(sortBy(ASSIGNED_NAME, SortDirection.DESC), List.of(ROW_5, ROW_3), List.of(ROW_2, ROW_4)));
    }

    private static Stream<Arguments> threePagesPerSort() {
        return Stream.of(
                arguments(null, List.of(ROW_5, ROW_4), List.of(ROW_3, ROW_2), List.of(ROW_1)),
                arguments(sortBy(ASSIGNED_NAME, SortDirection.ASC),
                        List.of(ROW_1, ROW_4), List.of(ROW_2, ROW_3), List.of(ROW_5)),
                arguments(sortBy(ASSIGNED_NAME, SortDirection.DESC),
                        List.of(ROW_5, ROW_3), List.of(ROW_2, ROW_4), List.of(ROW_1)),
                arguments(sortBy(UPDATED_AT, SortDirection.DESC),
                        List.of(ROW_1, ROW_4), List.of(ROW_3, ROW_2), List.of(ROW_5)),
                arguments(sortBy(TICKET_NUMBER, SortDirection.ASC),
                        List.of(ROW_1, ROW_2), List.of(ROW_3, ROW_4), List.of(ROW_5)));
    }

    private static Stream<Arguments> pagesOfFiveRows() {
        return Stream.of(
                arguments(false, 0, List.of(ROW_1, ROW_2), false, true),
                arguments(false, 2, List.of(ROW_3, ROW_4), true, true),
                arguments(false, 4, List.of(ROW_5), true, false),
                arguments(false, 5, List.of(), true, false),
                arguments(true, 0, List.of(ROW_4, ROW_5), true, false),
                arguments(true, 4, List.of(ROW_2, ROW_3), true, true),
                arguments(true, 3, List.of(ROW_1, ROW_2), false, true),
                arguments(true, 2, List.of(ROW_1), false, true),
                arguments(true, 1, List.of(), false, true));
    }

    private static Stream<Arguments> keysetsOfTheFirstTwoRows() {
        return Stream.of(
                arguments(null,
                        new KeysetCursor(ID, Sort.Direction.DESC, "", ROW_5),
                        new KeysetCursor(ID, Sort.Direction.DESC, "", ROW_4)),
                arguments(sortBy(UPDATED_AT, SortDirection.ASC),
                        KeysetCursor.ofInstant(UPDATED_AT, Sort.Direction.ASC, EARLY, ROW_5),
                        KeysetCursor.ofInstant(UPDATED_AT, Sort.Direction.ASC, MIDDLE, ROW_2)),
                arguments(sortBy(TICKET_NUMBER, SortDirection.DESC),
                        new KeysetCursor(TICKET_NUMBER, Sort.Direction.DESC, "105", ROW_5),
                        new KeysetCursor(TICKET_NUMBER, Sort.Direction.DESC, "104", ROW_4)),
                arguments(sortBy(ASSIGNED_NAME, SortDirection.ASC),
                        KeysetCursor.ofString(ASSIGNED_NAME, Sort.Direction.ASC, null, ROW_1),
                        KeysetCursor.ofString(ASSIGNED_NAME, Sort.Direction.ASC, null, ROW_4)),
                arguments(sortBy(ASSIGNED_NAME, SortDirection.DESC),
                        KeysetCursor.ofString(ASSIGNED_NAME, Sort.Direction.DESC, "Bob", ROW_5),
                        KeysetCursor.ofString(ASSIGNED_NAME, Sort.Direction.DESC, "Ann", ROW_3)));
    }

    private static Stream<Arguments> rawIdPagesPerSort() {
        return Stream.of(
                arguments(null, List.of(ROW_5, ROW_4), List.of(ROW_3, ROW_2)),
                arguments(sortBy(UPDATED_AT, SortDirection.DESC), List.of(ROW_1, ROW_4), List.of(ROW_3, ROW_2)),
                arguments(sortBy(TICKET_NUMBER, SortDirection.ASC), List.of(ROW_1, ROW_2), List.of(ROW_3, ROW_4)),
                arguments(sortBy(ASSIGNED_NAME, SortDirection.ASC), List.of(ROW_1, ROW_4), List.of(ROW_2, ROW_3)));
    }

    private static SortInput sortBy(String field, SortDirection direction) {
        return SortInput.builder().field(field).direction(direction).build();
    }

    private static PositionPaginationCriteria first(int first) {
        return PositionPaginationCriteria.builder().limit(first).build();
    }

    private static PositionPaginationCriteria firstAfter(int first, String after) {
        CursorPosition position = KeysetCursor.parse(after);
        return PositionPaginationCriteria.builder().position(position).limit(first).build();
    }

    private static PositionPaginationCriteria lastBefore(int last, String before) {
        CursorPosition position = KeysetCursor.parse(before);
        return PositionPaginationCriteria.builder().position(position).limit(last).backward(true).build();
    }

    private static CursorPaginationCriteria pagingBackward(int limit, String cursor) {
        return CursorPaginationCriteria.builder().limit(limit).cursor(cursor).backward(true).build();
    }

    private CursorPosition ticketNumberPositionOfRow(int row) {
        return row == 0
                ? NO_POSITION
                : cursorIssuer.keysetCursor(ticketRows().get(row - 1), TICKET_NUMBER, "ASC");
    }

    private void stubTicketPages(SortInput sort) {
        String sortField = sort == null ? ID : sort.getField();
        Sort.Direction direction = sort != null && sort.getDirection() == SortDirection.ASC
                ? Sort.Direction.ASC : Sort.Direction.DESC;
        String sortDirection = direction.name();
        Query query = new Query();
        when(ticketRepository.buildTicketQuery(any(), any(), any(), any())).thenReturn(query);
        stubSortResolution(sort);
        when(ticketRepository.findTicketsWithCursor(eq(query), any(CursorPosition.class), anyBoolean(), anyInt(),
                eq(sortField), eq(sortDirection)))
                .thenAnswer(call -> rowsPast(sortField, direction,
                        call.getArgument(1), call.getArgument(2), call.getArgument(3)));
        lenient().when(ticketRepository.keysetCursor(any(Ticket.class), eq(sortField), eq(sortDirection)))
                .thenAnswer(call -> cursorIssuer.keysetCursor(call.getArgument(0), sortField, sortDirection));
    }

    private void stubSortResolution(SortInput sort) {
        if (sort == null) {
            when(ticketRepository.getDefaultSortField()).thenReturn(ID);
        } else {
            when(ticketRepository.isSortableField(sort.getField())).thenReturn(true);
        }
    }

    private static List<Ticket> ticketRows() {
        return List.of(
                ticketRow(ROW_1, 101, null, LATE),
                ticketRow(ROW_2, 102, "Ann", MIDDLE),
                ticketRow(ROW_3, 103, "Ann", MIDDLE),
                ticketRow(ROW_4, 104, null, MIDDLE),
                ticketRow(ROW_5, 105, "Bob", EARLY));
    }

    private static Ticket ticketRow(String id, Integer ticketNumber, String assignedName, Instant updatedAt) {
        return Ticket.builder().id(id).ticketNumber(ticketNumber).assignedName(assignedName).updatedAt(updatedAt).build();
    }

    private static List<Ticket> rowsPast(String sortField, Sort.Direction direction, CursorPosition position,
                                         boolean backward, int limit) {
        Comparator<Ticket> displayOrder = displayOrder(sortField, direction);
        Comparator<Ticket> fetchOrder = backward ? displayOrder.reversed() : displayOrder;
        Optional<Ticket> anchor = anchorOf(position, sortField, direction);
        return ticketRows().stream()
                .sorted(fetchOrder)
                .filter(row -> anchor.map(past -> fetchOrder.compare(row, past) > 0).orElse(true))
                .limit(limit)
                .toList();
    }

    private static Comparator<Ticket> displayOrder(String sortField, Sort.Direction direction) {
        Comparator<Ticket> ascending = switch (sortField) {
            case TICKET_NUMBER -> Comparator
                    .comparing(Ticket::getTicketNumber, Comparator.nullsFirst(Comparator.<Integer>naturalOrder()))
                    .thenComparing(Ticket::getId);
            case ASSIGNED_NAME -> Comparator
                    .comparing(Ticket::getAssignedName, Comparator.nullsFirst(Comparator.<String>naturalOrder()))
                    .thenComparing(Ticket::getId);
            case UPDATED_AT -> Comparator
                    .comparing(Ticket::getUpdatedAt, Comparator.nullsFirst(Comparator.<Instant>naturalOrder()))
                    .thenComparing(Ticket::getId);
            default -> Comparator.comparing(Ticket::getId);
        };
        return direction.isAscending() ? ascending : ascending.reversed();
    }

    private static Optional<Ticket> anchorOf(CursorPosition position, String sortField, Sort.Direction direction) {
        return switch (position) {
            case KeysetCursor keyset -> {
                keyset.requireSort(sortField, direction);
                yield Optional.of(anchorRow(keyset, sortField));
            }
            case CursorPosition.RowId rowId when ID.equals(sortField) -> Optional.of(ticketRow(rowId.id(), null, null, null));
            case CursorPosition.RowId rowId -> Optional.of(rowReadById(rowId.id()));
            case CursorPosition.Unrecognised unrecognised -> throw new InvalidCursorException();
            case CursorPosition.None none -> Optional.empty();
        };
    }

    private static Ticket rowReadById(String id) {
        return ticketRows().stream()
                .filter(row -> row.getId().equals(id))
                .findFirst()
                .orElseThrow(InvalidCursorException::new);
    }

    private static Ticket anchorRow(KeysetCursor keyset, String sortField) {
        return switch (sortField) {
            case TICKET_NUMBER -> ticketRow(keyset.id(), ticketNumberOf(keyset), null, null);
            case ASSIGNED_NAME -> ticketRow(keyset.id(), null, keyset.stringValue(), null);
            case UPDATED_AT -> ticketRow(keyset.id(), null, null, keyset.instantValue());
            default -> ticketRow(keyset.id(), null, null, null);
        };
    }

    private static Integer ticketNumberOf(KeysetCursor keyset) {
        return keyset.hasNullValue() ? null : Integer.valueOf(keyset.rawValue());
    }
}
