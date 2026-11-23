package com.openframe.api.service;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.core.exception.InvalidCursorException;
import com.openframe.data.document.assignment.AssignmentTargetType;
import com.openframe.data.document.assignment.ItemAssignment;
import com.openframe.data.mongo.TenantAwareMongoTemplate;
import com.openframe.data.repository.assignment.CustomItemAssignmentRepository;
import com.openframe.data.repository.assignment.CustomItemAssignmentRepositoryImpl;
import com.openframe.data.repository.assignment.ItemAssignmentRepository;
import com.openframe.data.repository.cursor.CursorBase64;
import com.openframe.data.repository.cursor.CursorPosition;
import com.openframe.data.repository.cursor.KeysetCursor;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.knowledgebase.KnowledgeBaseItemRepository;
import com.openframe.data.repository.organization.OrganizationRepository;
import com.openframe.data.repository.ticket.TicketRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Sort;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.junit.jupiter.params.provider.Arguments.arguments;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AssignmentServicePaginationTest {

    private static final String ITEM_ID = "item-1";
    private static final AssignmentTargetType TARGET_TYPE = AssignmentTargetType.DEVICE;
    private static final String CREATED_AT = "createdAt";
    private static final String DISPLAY_NAME = "displayName";
    private static final String ASC = "ASC";
    private static final String DESC = "DESC";
    private static final String KEYSET_PREFIX = "k1|";
    private static final String INVALID_CURSOR = "Invalid cursor";
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
    private static final List<String> BY_NAME_ASCENDING = List.of(ROW_4, ROW_1, ROW_2, ROW_3, ROW_5);

    @Mock private ItemAssignmentRepository repository;
    @Mock private OrganizationRepository organizationRepository;
    @Mock private MachineRepository machineRepository;
    @Mock private TicketRepository ticketRepository;
    @Mock private KnowledgeBaseItemRepository knowledgeBaseItemRepository;

    @InjectMocks private AssignmentService service;

    private final CustomItemAssignmentRepository cursorIssuer =
            new CustomItemAssignmentRepositoryImpl(mock(TenantAwareMongoTemplate.class));

    @ParameterizedTest
    @MethodSource("sortsOverRowsWithNullsAndEqualValues")
    void queryAssignments_pageOneThenPageTwoThenBeforePageTwo_returnsPageOneAgain(
            SortInput sort, List<String> pageOneRows, List<String> pageTwoRows) {
        // setup
        stubAssignmentPages(sort);

        // execution
        CountedGenericQueryResult<ItemAssignment> pageOne =
                service.queryAssignments(ITEM_ID, TARGET_TYPE, forward(2, null), null, sort);
        CountedGenericQueryResult<ItemAssignment> pageTwo = service.queryAssignments(
                ITEM_ID, TARGET_TYPE, forward(2, pageOne.getPageInfo().getEndCursor()), null, sort);
        CountedGenericQueryResult<ItemAssignment> backToPageOne = service.queryAssignments(
                ITEM_ID, TARGET_TYPE, backward(2, pageTwo.getPageInfo().getStartCursor()), null, sort);

        // verifications
        assertThat(pageOne.getItems()).extracting(ItemAssignment::getId).containsExactlyElementsOf(pageOneRows);
        assertThat(pageTwo.getItems()).extracting(ItemAssignment::getId).containsExactlyElementsOf(pageTwoRows);
        assertThat(backToPageOne.getItems()).extracting(ItemAssignment::getId).containsExactlyElementsOf(pageOneRows);
        assertThat(backToPageOne.getPageInfo())
                .returns(pageOne.getPageInfo().getStartCursor(), PageInfo::getStartCursor)
                .returns(pageOne.getPageInfo().getEndCursor(), PageInfo::getEndCursor);
    }

    @ParameterizedTest
    @MethodSource("pagesOfFiveRows")
    void queryAssignments_eachPageInEachDirection_rowsInDisplayOrderWithBothFlags(
            boolean backward, int anchorRow, List<String> expectedRows, boolean hasPreviousPage, boolean hasNextPage) {
        // setup
        SortInput sort = sortBy(DISPLAY_NAME, SortDirection.ASC);
        stubAssignmentPages(sort);
        String cursor = nameCursorOfDisplayedRow(anchorRow);
        CursorPaginationCriteria pagination = connectionPage(backward, 2, cursor);

        // execution
        CountedGenericQueryResult<ItemAssignment> result =
                service.queryAssignments(ITEM_ID, TARGET_TYPE, pagination, null, sort);

        // verifications
        assertThat(result.getItems()).extracting(ItemAssignment::getId).containsExactlyElementsOf(expectedRows);
        assertThat(result.getPageInfo())
                .returns(hasPreviousPage, PageInfo::isHasPreviousPage)
                .returns(hasNextPage, PageInfo::isHasNextPage);
    }

    @Test
    void queryAssignments_lastWithoutBefore_lastRowsInDisplayOrderAndNoNextPage() {
        // setup
        SortInput sort = sortBy(DISPLAY_NAME, SortDirection.ASC);
        stubAssignmentPages(sort);

        // execution
        CountedGenericQueryResult<ItemAssignment> result =
                service.queryAssignments(ITEM_ID, TARGET_TYPE, backward(2, null), null, sort);

        // verifications
        assertThat(result.getItems()).extracting(ItemAssignment::getId).containsExactly(ROW_3, ROW_5);
        assertThat(result.getPageInfo())
                .returns(false, PageInfo::isHasNextPage)
                .returns(true, PageInfo::isHasPreviousPage);
        verify(repository).findAssignmentsWithCursor(
                ITEM_ID, TARGET_TYPE, null, DISPLAY_NAME, ASC, NO_POSITION, true, 3);
    }

    @ParameterizedTest
    @MethodSource("keysetsOfTheFirstTwoRows")
    void queryAssignments_pageInfoCursors_keysetCursorsOfTheFirstAndLastShownRows(
            SortInput sort, KeysetCursor expectedStart, KeysetCursor expectedEnd) {
        // setup
        stubAssignmentPages(sort);

        // execution
        PageInfo pageInfo = service.queryAssignments(ITEM_ID, TARGET_TYPE, forward(2, null), null, sort).getPageInfo();

        // verifications
        assertThat(KeysetCursor.parse(pageInfo.getStartCursor())).isEqualTo(expectedStart);
        assertThat(KeysetCursor.parse(pageInfo.getEndCursor())).isEqualTo(expectedEnd);
        assertThat(CursorBase64.decode(pageInfo.getStartCursor())).startsWith(KEYSET_PREFIX);
        assertThat(CursorBase64.decode(pageInfo.getEndCursor())).startsWith(KEYSET_PREFIX);
    }

    @Test
    void queryAssignments_plainIdOfTheLastShownRowAsTheCursor_pagesOnPastThatRowUnderTheDefaultSort() {
        // setup
        stubAssignmentPages(null);
        CursorPaginationCriteria afterTheLastShownRow = CursorPaginationCriteria.builder().limit(2).cursor(ROW_3).build();

        // execution
        CountedGenericQueryResult<ItemAssignment> result =
                service.queryAssignments(ITEM_ID, TARGET_TYPE, afterTheLastShownRow, null, null);

        // verifications
        assertThat(result.getItems()).extracting(ItemAssignment::getId).containsExactly(ROW_2, ROW_1);
        assertThat(result.getPageInfo())
                .returns(true, PageInfo::isHasNextPage)
                .returns(true, PageInfo::isHasPreviousPage);
        verify(repository).findAssignmentsWithCursor(
                ITEM_ID, TARGET_TYPE, null, CREATED_AT, DESC, new CursorPosition.RowId(ROW_3), false, 3);
    }

    @Test
    void queryAssignments_base64RowIdOfAnOlderPageCursor_stillPagesPastThatRow() {
        // setup
        stubAssignmentPages(null);
        CursorPaginationCriteria pagination = forward(2, CursorCodec.encode(ROW_3));

        // execution
        CountedGenericQueryResult<ItemAssignment> result =
                service.queryAssignments(ITEM_ID, TARGET_TYPE, pagination, null, null);

        // verifications
        assertThat(result.getItems()).extracting(ItemAssignment::getId).containsExactly(ROW_2, ROW_1);
        verify(repository).findAssignmentsWithCursor(
                ITEM_ID, TARGET_TYPE, null, CREATED_AT, DESC, new CursorPosition.RowId(ROW_3), false, 3);
    }

    @Test
    void queryAssignments_base64RowIdBackward_rowsBeforeThatRowInDisplayOrder() {
        // setup
        stubAssignmentPages(null);
        CursorPaginationCriteria pagination = backward(2, CursorCodec.encode(ROW_2));

        // execution
        CountedGenericQueryResult<ItemAssignment> result =
                service.queryAssignments(ITEM_ID, TARGET_TYPE, pagination, null, null);

        // verifications
        assertThat(result.getItems()).extracting(ItemAssignment::getId).containsExactly(ROW_5, ROW_3);
        assertThat(result.getPageInfo())
                .returns(true, PageInfo::isHasNextPage)
                .returns(false, PageInfo::isHasPreviousPage);
    }

    @Test
    void queryAssignments_rowIdWhoseRowIsGoneUnderTheDefaultSort_throwsInvalidCursor() {
        // setup
        stubAssignmentPages(null);
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().limit(2).cursor(GONE_ROW).build();

        // execution
        Throwable thrown = catchThrowable(
                () -> service.queryAssignments(ITEM_ID, TARGET_TYPE, pagination, null, null));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
    }

    @Test
    void queryAssignments_decodedKeysetCursorBackward_repositoryGetsTheKeysetPositionAndTheDirection() {
        // setup
        SortInput sort = sortBy(DISPLAY_NAME, SortDirection.ASC);
        when(repository.isSortableField(DISPLAY_NAME)).thenReturn(true);
        KeysetCursor cursor = KeysetCursor.ofString(DISPLAY_NAME, Sort.Direction.ASC, "beta", ROW_3);
        CursorPaginationCriteria pagination = backward(2, cursor.encode());

        // execution
        service.queryAssignments(ITEM_ID, TARGET_TYPE, pagination, null, sort);

        // verifications
        verify(repository).findAssignmentsWithCursor(ITEM_ID, TARGET_TYPE, null, DISPLAY_NAME, ASC, cursor, true, 3);
    }

    @Test
    void queryAssignments_cursorInAnotherFormat_leftToTheRepositoryToReject() {
        // setup
        CursorPosition unrecognised = new CursorPosition.Unrecognised("not-an-assignment-cursor");
        CursorPaginationCriteria pagination =
                CursorPaginationCriteria.builder().limit(2).cursor("not-an-assignment-cursor").build();
        when(repository.getDefaultSortField()).thenReturn(CREATED_AT);
        when(repository.findAssignmentsWithCursor(ITEM_ID, TARGET_TYPE, null, CREATED_AT, DESC, unrecognised, false, 3))
                .thenThrow(new InvalidCursorException());

        // execution
        Throwable thrown = catchThrowable(
                () -> service.queryAssignments(ITEM_ID, TARGET_TYPE, pagination, null, null));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
    }

    @Test
    void queryAssignments_malformedKeysetPayload_throwsInvalidCursorBeforeAnyPageIsRead() {
        // setup
        CursorPaginationCriteria pagination =
                CursorPaginationCriteria.builder().limit(2).cursor("k1|displayName|ASC").build();

        // execution
        Throwable thrown = catchThrowable(
                () -> service.queryAssignments(ITEM_ID, TARGET_TYPE, pagination, null, null));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
        verify(repository, never()).findAssignmentsWithCursor(anyString(), any(AssignmentTargetType.class), isNull(),
                anyString(), anyString(), any(CursorPosition.class), anyBoolean(), anyInt());
    }

    private static Stream<Arguments> sortsOverRowsWithNullsAndEqualValues() {
        return Stream.of(
                arguments(null, List.of(ROW_5, ROW_3), List.of(ROW_2, ROW_1)),
                arguments(sortBy(CREATED_AT, SortDirection.ASC), List.of(ROW_4, ROW_1), List.of(ROW_2, ROW_3)),
                arguments(sortBy(DISPLAY_NAME, SortDirection.ASC), List.of(ROW_4, ROW_1), List.of(ROW_2, ROW_3)),
                arguments(sortBy(DISPLAY_NAME, SortDirection.DESC), List.of(ROW_5, ROW_3), List.of(ROW_2, ROW_1)));
    }

    private static Stream<Arguments> pagesOfFiveRows() {
        return Stream.of(
                arguments(false, 0, List.of(ROW_4, ROW_1), false, true),
                arguments(false, 2, List.of(ROW_2, ROW_3), true, true),
                arguments(false, 4, List.of(ROW_5), true, false),
                arguments(false, 5, List.of(), true, false),
                arguments(true, 0, List.of(ROW_3, ROW_5), true, false),
                arguments(true, 5, List.of(ROW_2, ROW_3), true, true),
                arguments(true, 3, List.of(ROW_4, ROW_1), false, true),
                arguments(true, 2, List.of(ROW_4), false, true),
                arguments(true, 1, List.of(), false, true));
    }

    private static Stream<Arguments> keysetsOfTheFirstTwoRows() {
        return Stream.of(
                arguments(null,
                        KeysetCursor.ofInstant(CREATED_AT, Sort.Direction.DESC, LATE, ROW_5),
                        KeysetCursor.ofInstant(CREATED_AT, Sort.Direction.DESC, MIDDLE, ROW_3)),
                arguments(sortBy(CREATED_AT, SortDirection.ASC),
                        KeysetCursor.ofInstant(CREATED_AT, Sort.Direction.ASC, null, ROW_4),
                        KeysetCursor.ofInstant(CREATED_AT, Sort.Direction.ASC, EARLY, ROW_1)),
                arguments(sortBy(DISPLAY_NAME, SortDirection.ASC),
                        KeysetCursor.ofString(DISPLAY_NAME, Sort.Direction.ASC, null, ROW_4),
                        KeysetCursor.ofString(DISPLAY_NAME, Sort.Direction.ASC, "alpha", ROW_1)),
                arguments(sortBy(DISPLAY_NAME, SortDirection.DESC),
                        KeysetCursor.ofString(DISPLAY_NAME, Sort.Direction.DESC, "gamma", ROW_5),
                        KeysetCursor.ofString(DISPLAY_NAME, Sort.Direction.DESC, "beta", ROW_3)));
    }

    private static SortInput sortBy(String field, SortDirection direction) {
        return SortInput.builder().field(field).direction(direction).build();
    }

    private static CursorPaginationCriteria forward(int first, String after) {
        ConnectionArgs args = ConnectionArgs.builder().first(first).after(after).build();
        return CursorPaginationCriteria.fromConnectionArgs(args);
    }

    private static CursorPaginationCriteria backward(int last, String before) {
        ConnectionArgs args = ConnectionArgs.builder().last(last).before(before).build();
        return CursorPaginationCriteria.fromConnectionArgs(args);
    }

    private static CursorPaginationCriteria connectionPage(boolean backward, int limit, String cursor) {
        return backward ? backward(limit, cursor) : forward(limit, cursor);
    }

    private static List<ItemAssignment> assignments() {
        return List.of(
                assignment(ROW_1, "alpha", EARLY),
                assignment(ROW_2, "beta", MIDDLE),
                assignment(ROW_3, "beta", MIDDLE),
                assignment(ROW_4, null, null),
                assignment(ROW_5, "gamma", LATE));
    }

    private static ItemAssignment assignment(String id, String displayName, Instant createdAt) {
        return ItemAssignment.builder().id(id).displayName(displayName).createdAt(createdAt).build();
    }

    private static List<ItemAssignment> rowsPast(String sortField, String direction, CursorPosition position,
                                                 boolean backward, int limit) {
        Comparator<ItemAssignment> displayOrder = displayOrder(sortField, direction);
        Comparator<ItemAssignment> fetchOrder = backward ? displayOrder.reversed() : displayOrder;
        Optional<ItemAssignment> anchor = anchorOf(position, sortField);
        return assignments().stream()
                .sorted(fetchOrder)
                .filter(row -> anchor.map(past -> fetchOrder.compare(row, past) > 0).orElse(true))
                .limit(limit)
                .toList();
    }

    private static Comparator<ItemAssignment> displayOrder(String sortField, String direction) {
        Comparator<ItemAssignment> ascending = DISPLAY_NAME.equals(sortField)
                ? nullsFirst(ItemAssignment::getDisplayName)
                : nullsFirst(ItemAssignment::getCreatedAt);
        Comparator<ItemAssignment> ascendingWithTieBreak = ascending.thenComparing(ItemAssignment::getId);
        return ASC.equals(direction) ? ascendingWithTieBreak : ascendingWithTieBreak.reversed();
    }

    private static <V extends Comparable<V>> Comparator<ItemAssignment> nullsFirst(Function<ItemAssignment, V> value) {
        Comparator<V> valuesAfterNulls = Comparator.nullsFirst(Comparator.naturalOrder());
        return Comparator.comparing(value, valuesAfterNulls);
    }

    private static Optional<ItemAssignment> anchorOf(CursorPosition position, String sortField) {
        return switch (position) {
            case KeysetCursor keyset -> Optional.of(anchorRow(keyset, sortField));
            case CursorPosition.RowId rowId -> Optional.of(rowReadById(rowId.id()));
            case CursorPosition.Unrecognised _ -> throw new InvalidCursorException();
            case CursorPosition.None _ -> Optional.empty();
        };
    }

    private static ItemAssignment rowReadById(String id) {
        return assignments().stream()
                .filter(row -> row.getId().equals(id))
                .findFirst()
                .orElseThrow(InvalidCursorException::new);
    }

    private static ItemAssignment anchorRow(KeysetCursor keyset, String sortField) {
        return DISPLAY_NAME.equals(sortField)
                ? assignment(keyset.id(), keyset.stringValue(), null)
                : assignment(keyset.id(), null, keyset.instantValue());
    }

    private String nameCursorOfDisplayedRow(int row) {
        return row == 0 ? null : cursorIssuer.keysetCursor(displayedByName(row), DISPLAY_NAME, ASC).encode();
    }

    private static ItemAssignment displayedByName(int row) {
        return rowReadById(BY_NAME_ASCENDING.get(row - 1));
    }

    private void stubSortResolution(SortInput sort) {
        if (sort == null) {
            when(repository.getDefaultSortField()).thenReturn(CREATED_AT);
        } else {
            when(repository.isSortableField(sort.getField())).thenReturn(true);
        }
    }

    private void stubAssignmentPages(SortInput sort) {
        String sortField = sort == null ? CREATED_AT : sort.getField();
        String direction = sort == null ? DESC : sort.getDirection().name();
        stubSortResolution(sort);
        when(repository.findAssignmentsWithCursor(eq(ITEM_ID), eq(TARGET_TYPE), isNull(), eq(sortField), eq(direction),
                any(CursorPosition.class), anyBoolean(), anyInt()))
                .thenAnswer(call -> rowsPast(sortField, direction,
                        call.getArgument(5), call.getArgument(6), call.getArgument(7)));
        lenient().when(repository.keysetCursor(any(ItemAssignment.class), eq(sortField), eq(direction)))
                .thenAnswer(call -> cursorIssuer.keysetCursor(call.getArgument(0), sortField, direction));
    }
}
