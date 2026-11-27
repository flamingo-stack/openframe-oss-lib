package com.openframe.api.service;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.core.exception.InvalidCursorException;
import com.openframe.data.document.timetracking.TimeEntry;
import com.openframe.data.mongo.TenantAwareMongoTemplate;
import com.openframe.data.repository.cursor.CursorBase64;
import com.openframe.data.repository.cursor.CursorPosition;
import com.openframe.data.repository.cursor.KeysetCursor;
import com.openframe.data.repository.timetracking.CustomTimeEntryRepository;
import com.openframe.data.repository.timetracking.CustomTimeEntryRepositoryImpl;
import com.openframe.data.repository.timetracking.TimeEntryRepository;
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
import java.time.LocalDate;
import java.time.ZoneOffset;
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
class TimeEntryServicePaginationTest {

    private static final String DATE = "date";
    private static final String STARTED_AT = "startedAt";
    private static final String ENDED_AT = "endedAt";
    private static final String DURATION_SECONDS = "durationSeconds";
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
    private static final String SECOND_DAY = "2023-11-14";
    private static final String THIRD_DAY = "2023-11-15";
    private static final Instant EARLY = Instant.parse("2023-11-13T10:00:00Z");
    private static final Instant MIDDLE = Instant.parse("2023-11-14T09:30:00Z");
    private static final Instant LATE = Instant.parse("2023-11-14T15:00:01Z");
    private static final Instant LATEST = Instant.parse("2023-11-15T08:00:00Z");
    private static final CursorPosition NO_POSITION = new CursorPosition.None();
    private static final List<String> BY_DATE_DESCENDING = List.of(ROW_5, ROW_4, ROW_3, ROW_2, ROW_1);

    @Mock private TimeEntryRepository timeEntryRepository;
    @Mock private TicketQueryService ticketQueryService;

    @InjectMocks private TimeEntryService service;

    private final CustomTimeEntryRepository cursorIssuer =
            new CustomTimeEntryRepositoryImpl(mock(TenantAwareMongoTemplate.class));

    @ParameterizedTest
    @MethodSource("sortsOverRowsWithNullsAndEqualValues")
    void queryEntries_pageOneThenPageTwoThenBeforePageTwo_returnsPageOneAgain(
            SortInput sort, List<String> pageOneRows, List<String> pageTwoRows) {
        // setup
        stubEntryPages(sort);

        // execution
        CountedGenericQueryResult<TimeEntry> pageOne = service.queryEntries(null, null, forward(2, null), sort);
        CountedGenericQueryResult<TimeEntry> pageTwo =
                service.queryEntries(null, null, forward(2, pageOne.getPageInfo().getEndCursor()), sort);
        CountedGenericQueryResult<TimeEntry> backToPageOne =
                service.queryEntries(null, null, backward(2, pageTwo.getPageInfo().getStartCursor()), sort);

        // verifications
        assertThat(pageOne.getItems()).extracting(TimeEntry::getId).containsExactlyElementsOf(pageOneRows);
        assertThat(pageTwo.getItems()).extracting(TimeEntry::getId).containsExactlyElementsOf(pageTwoRows);
        assertThat(backToPageOne.getItems()).extracting(TimeEntry::getId).containsExactlyElementsOf(pageOneRows);
        assertThat(backToPageOne.getPageInfo())
                .returns(pageOne.getPageInfo().getStartCursor(), PageInfo::getStartCursor)
                .returns(pageOne.getPageInfo().getEndCursor(), PageInfo::getEndCursor);
    }

    @ParameterizedTest
    @MethodSource("pagesOfFiveRows")
    void queryEntries_eachPageInEachDirectionUnderTheDefaultSort_rowsInDisplayOrderWithBothFlags(
            boolean backward, int anchorRow, List<String> expectedRows, boolean hasPreviousPage, boolean hasNextPage) {
        // setup
        stubEntryPages(null);
        String cursor = dateCursorOfDisplayedRow(anchorRow);
        CursorPaginationCriteria pagination = connectionPage(backward, 2, cursor);

        // execution
        CountedGenericQueryResult<TimeEntry> result = service.queryEntries(null, null, pagination, null);

        // verifications
        assertThat(result.getItems()).extracting(TimeEntry::getId).containsExactlyElementsOf(expectedRows);
        assertThat(result.getPageInfo())
                .returns(hasPreviousPage, PageInfo::isHasPreviousPage)
                .returns(hasNextPage, PageInfo::isHasNextPage);
    }

    @Test
    void queryEntries_lastWithoutBefore_lastRowsInDisplayOrderAndNoNextPage() {
        // setup
        stubEntryPages(null);

        // execution
        CountedGenericQueryResult<TimeEntry> result = service.queryEntries(null, null, backward(2, null), null);

        // verifications
        assertThat(result.getItems()).extracting(TimeEntry::getId).containsExactly(ROW_2, ROW_1);
        assertThat(result.getPageInfo())
                .returns(false, PageInfo::isHasNextPage)
                .returns(true, PageInfo::isHasPreviousPage);
        verify(timeEntryRepository).findTimeEntriesWithCursor(null, NO_POSITION, true, 3, DATE, DESC);
    }

    @ParameterizedTest
    @MethodSource("keysetsOfTheFirstTwoRows")
    void queryEntries_pageInfoCursors_keysetCursorsOfTheFirstAndLastShownRows(
            SortInput sort, KeysetCursor expectedStart, KeysetCursor expectedEnd) {
        // setup
        stubEntryPages(sort);

        // execution
        PageInfo pageInfo = service.queryEntries(null, null, forward(2, null), sort).getPageInfo();

        // verifications
        assertThat(KeysetCursor.parse(pageInfo.getStartCursor())).isEqualTo(expectedStart);
        assertThat(KeysetCursor.parse(pageInfo.getEndCursor())).isEqualTo(expectedEnd);
        assertThat(CursorBase64.decode(pageInfo.getStartCursor())).startsWith(KEYSET_PREFIX);
        assertThat(CursorBase64.decode(pageInfo.getEndCursor())).startsWith(KEYSET_PREFIX);
    }

    @Test
    void queryEntries_olderDayCreatedAtIdCursorUnderTheDefaultSort_stillPagesPastThatRow() {
        // setup
        stubEntryPages(null);
        String olderCursorOfRowFour = SECOND_DAY + "_" + LATE.toEpochMilli() + "_" + ROW_4;
        CursorPaginationCriteria pagination = forward(2, CursorCodec.encode(olderCursorOfRowFour));

        // execution
        CountedGenericQueryResult<TimeEntry> result = service.queryEntries(null, null, pagination, null);

        // verifications
        assertThat(result.getItems()).extracting(TimeEntry::getId).containsExactly(ROW_3, ROW_2);
        verify(timeEntryRepository).findTimeEntriesWithCursor(
                null, new CursorPosition.Unrecognised(olderCursorOfRowFour), false, 3, DATE, DESC);
    }

    @Test
    void queryEntries_olderDayCreatedAtIdCursorBackward_rowsBeforeThatRowInDisplayOrder() {
        // setup
        stubEntryPages(null);
        String olderCursorOfRowThree = SECOND_DAY + "_" + MIDDLE.toEpochMilli() + "_" + ROW_3;
        CursorPaginationCriteria pagination = backward(2, CursorCodec.encode(olderCursorOfRowThree));

        // execution
        CountedGenericQueryResult<TimeEntry> result = service.queryEntries(null, null, pagination, null);

        // verifications
        assertThat(result.getItems()).extracting(TimeEntry::getId).containsExactly(ROW_5, ROW_4);
        assertThat(result.getPageInfo())
                .returns(true, PageInfo::isHasNextPage)
                .returns(false, PageInfo::isHasPreviousPage);
    }

    @Test
    void queryEntries_base64RowIdOfAnOlderPageCursorUnderAValueSort_stillPagesPastThatRow() {
        // setup
        SortInput sort = sortBy(STARTED_AT, SortDirection.ASC);
        stubEntryPages(sort);
        CursorPaginationCriteria pagination = forward(2, CursorCodec.encode(ROW_3));

        // execution
        CountedGenericQueryResult<TimeEntry> result = service.queryEntries(null, null, pagination, sort);

        // verifications
        assertThat(result.getItems()).extracting(TimeEntry::getId).containsExactly(ROW_2, ROW_4);
        verify(timeEntryRepository).findTimeEntriesWithCursor(
                null, new CursorPosition.RowId(ROW_3), false, 3, STARTED_AT, ASC);
    }

    @Test
    void queryEntries_rowIdWhoseRowIsGoneUnderAValueSort_throwsInvalidCursor() {
        // setup
        SortInput sort = sortBy(STARTED_AT, SortDirection.ASC);
        stubEntryPages(sort);
        CursorPaginationCriteria pagination = forward(2, CursorCodec.encode(GONE_ROW));

        // execution
        Throwable thrown = catchThrowable(() -> service.queryEntries(null, null, pagination, sort));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
    }

    @Test
    void queryEntries_decodedKeysetCursorBackward_repositoryGetsTheKeysetPositionAndTheDirection() {
        // setup
        SortInput sort = sortBy(ENDED_AT, SortDirection.DESC);
        when(timeEntryRepository.isSortableField(ENDED_AT)).thenReturn(true);
        KeysetCursor cursor = KeysetCursor.ofInstant(ENDED_AT, Sort.Direction.DESC, MIDDLE, ROW_3);
        CursorPaginationCriteria pagination = backward(2, cursor.encode());

        // execution
        service.queryEntries(null, null, pagination, sort);

        // verifications
        verify(timeEntryRepository).findTimeEntriesWithCursor(null, cursor, true, 3, ENDED_AT, DESC);
    }

    @Test
    void queryEntries_cursorInAnotherFormatUnderAValueSort_leftToTheRepositoryToReject() {
        // setup
        SortInput sort = sortBy(STARTED_AT, SortDirection.ASC);
        CursorPosition unrecognised = new CursorPosition.Unrecognised("not-a-time-entry-cursor");
        CursorPaginationCriteria pagination =
                CursorPaginationCriteria.builder().limit(2).cursor("not-a-time-entry-cursor").build();
        when(timeEntryRepository.isSortableField(STARTED_AT)).thenReturn(true);
        when(timeEntryRepository.findTimeEntriesWithCursor(null, unrecognised, false, 3, STARTED_AT, ASC))
                .thenThrow(new InvalidCursorException());

        // execution
        Throwable thrown = catchThrowable(() -> service.queryEntries(null, null, pagination, sort));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
    }

    @Test
    void queryEntries_malformedKeysetPayload_throwsInvalidCursorBeforeAnyPageIsRead() {
        // setup
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().limit(2).cursor("k1|date|DESC").build();

        // execution
        Throwable thrown = catchThrowable(() -> service.queryEntries(null, null, pagination, null));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
        verify(timeEntryRepository, never()).findTimeEntriesWithCursor(
                isNull(), any(CursorPosition.class), anyBoolean(), anyInt(), anyString(), anyString());
    }

    private static Stream<Arguments> sortsOverRowsWithNullsAndEqualValues() {
        return Stream.of(
                arguments(null, List.of(ROW_5, ROW_4), List.of(ROW_3, ROW_2)),
                arguments(sortBy(DATE, SortDirection.ASC), List.of(ROW_1, ROW_2), List.of(ROW_3, ROW_4)),
                arguments(sortBy(STARTED_AT, SortDirection.ASC), List.of(ROW_1, ROW_3), List.of(ROW_2, ROW_4)),
                arguments(sortBy(ENDED_AT, SortDirection.DESC), List.of(ROW_5, ROW_2), List.of(ROW_3, ROW_1)),
                arguments(sortBy(ENDED_AT, SortDirection.ASC), List.of(ROW_4, ROW_1), List.of(ROW_3, ROW_2)),
                arguments(sortBy(DURATION_SECONDS, SortDirection.ASC), List.of(ROW_2, ROW_3), List.of(ROW_4, ROW_1)),
                arguments(sortBy(DURATION_SECONDS, SortDirection.DESC), List.of(ROW_5, ROW_1), List.of(ROW_4, ROW_3)));
    }

    private static Stream<Arguments> pagesOfFiveRows() {
        return Stream.of(
                arguments(false, 0, List.of(ROW_5, ROW_4), false, true),
                arguments(false, 2, List.of(ROW_3, ROW_2), true, true),
                arguments(false, 4, List.of(ROW_1), true, false),
                arguments(false, 5, List.of(), true, false),
                arguments(true, 0, List.of(ROW_2, ROW_1), true, false),
                arguments(true, 5, List.of(ROW_3, ROW_2), true, true),
                arguments(true, 3, List.of(ROW_5, ROW_4), false, true),
                arguments(true, 2, List.of(ROW_5), false, true),
                arguments(true, 1, List.of(), false, true));
    }

    private static Stream<Arguments> keysetsOfTheFirstTwoRows() {
        String dayAndCreatedAtOfRowFive = THIRD_DAY + "_" + LATEST.toEpochMilli();
        String dayAndCreatedAtOfRowFour = SECOND_DAY + "_" + LATE.toEpochMilli();
        return Stream.of(
                arguments(null,
                        new KeysetCursor(DATE, Sort.Direction.DESC, dayAndCreatedAtOfRowFive, ROW_5),
                        new KeysetCursor(DATE, Sort.Direction.DESC, dayAndCreatedAtOfRowFour, ROW_4)),
                arguments(sortBy(ENDED_AT, SortDirection.ASC),
                        KeysetCursor.ofInstant(ENDED_AT, Sort.Direction.ASC, null, ROW_4),
                        KeysetCursor.ofInstant(ENDED_AT, Sort.Direction.ASC, Instant.parse("2023-11-13T10:00:00Z"), ROW_1)),
                arguments(sortBy(DURATION_SECONDS, SortDirection.DESC),
                        new KeysetCursor(DURATION_SECONDS, Sort.Direction.DESC, "7200", ROW_5),
                        new KeysetCursor(DURATION_SECONDS, Sort.Direction.DESC, "3600", ROW_1)));
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

    private static List<TimeEntry> entries() {
        return List.of(
                entry(ROW_1, "2023-11-13T09:00:00Z", "2023-11-13T10:00:00Z", EARLY, 3600L),
                entry(ROW_2, "2023-11-14T08:00:00Z", "2023-11-14T09:00:00Z", MIDDLE, 1800L),
                entry(ROW_3, "2023-11-14T00:00:00Z", "2023-11-14T00:30:00Z", MIDDLE, 1800L),
                entry(ROW_4, "2023-11-14T15:00:00Z", null, LATE, 1800L),
                entry(ROW_5, "2023-11-15T07:00:00Z", "2023-11-15T08:00:00Z", LATEST, 7200L));
    }

    private static TimeEntry entry(String id, String startedAt, String endedAt, Instant createdAt, long durationSeconds) {
        return TimeEntry.builder()
                .id(id)
                .startedAt(Instant.parse(startedAt))
                .endedAt(endedAt == null ? null : Instant.parse(endedAt))
                .createdAt(createdAt)
                .durationSeconds(durationSeconds)
                .build();
    }

    private static List<TimeEntry> rowsPast(String sortField, String direction, CursorPosition position,
                                            boolean backward, int limit) {
        Comparator<TimeEntry> displayOrder = displayOrder(sortField, direction);
        Comparator<TimeEntry> fetchOrder = backward ? displayOrder.reversed() : displayOrder;
        Optional<TimeEntry> anchor = anchorOf(position, sortField);
        return entries().stream()
                .sorted(fetchOrder)
                .filter(row -> anchor.map(past -> fetchOrder.compare(row, past) > 0).orElse(true))
                .limit(limit)
                .toList();
    }

    private static Comparator<TimeEntry> displayOrder(String sortField, String direction) {
        Comparator<TimeEntry> ascending = switch (sortField) {
            case DATE -> Comparator.comparing(TimeEntryServicePaginationTest::dayOf)
                    .thenComparing(TimeEntry::getCreatedAt);
            case STARTED_AT -> nullsFirst(TimeEntry::getStartedAt);
            case ENDED_AT -> nullsFirst(TimeEntry::getEndedAt);
            default -> Comparator.comparing(TimeEntry::getDurationSeconds);
        };
        Comparator<TimeEntry> ascendingWithTieBreak = ascending.thenComparing(TimeEntry::getId);
        return ASC.equals(direction) ? ascendingWithTieBreak : ascendingWithTieBreak.reversed();
    }

    private static Comparator<TimeEntry> nullsFirst(Function<TimeEntry, Instant> value) {
        Comparator<Instant> valuesAfterNulls = Comparator.nullsFirst(Comparator.naturalOrder());
        return Comparator.comparing(value, valuesAfterNulls);
    }

    private static LocalDate dayOf(TimeEntry entry) {
        return LocalDate.ofInstant(entry.getStartedAt(), ZoneOffset.UTC);
    }

    private static Optional<TimeEntry> anchorOf(CursorPosition position, String sortField) {
        return switch (position) {
            case KeysetCursor keyset -> Optional.of(anchorRow(keyset, sortField));
            case CursorPosition.RowId rowId -> Optional.of(rowReadById(rowId.id()));
            case CursorPosition.Unrecognised older when DATE.equals(sortField) ->
                    Optional.of(olderDateAnchor(older.decoded()));
            case CursorPosition.Unrecognised _ -> throw new InvalidCursorException();
            case CursorPosition.None _ -> Optional.empty();
        };
    }

    private static TimeEntry rowReadById(String id) {
        return entries().stream()
                .filter(row -> row.getId().equals(id))
                .findFirst()
                .orElseThrow(InvalidCursorException::new);
    }

    private static TimeEntry anchorRow(KeysetCursor keyset, String sortField) {
        TimeEntry anchor = TimeEntry.builder().id(keyset.id()).build();
        switch (sortField) {
            case DATE -> placeOnDay(anchor, keyset.rawValue());
            case STARTED_AT -> anchor.setStartedAt(keyset.instantValue());
            case ENDED_AT -> anchor.setEndedAt(keyset.instantValue());
            default -> anchor.setDurationSeconds(Long.parseLong(keyset.rawValue()));
        }
        return anchor;
    }

    private static TimeEntry olderDateAnchor(String dayCreatedAtAndId) {
        int idStart = dayCreatedAtAndId.lastIndexOf('_');
        TimeEntry anchor = TimeEntry.builder().id(dayCreatedAtAndId.substring(idStart + 1)).build();
        placeOnDay(anchor, dayCreatedAtAndId.substring(0, idStart));
        return anchor;
    }

    private static void placeOnDay(TimeEntry anchor, String dayAndCreatedAt) {
        String[] parts = dayAndCreatedAt.split("_");
        Instant startOfDay = LocalDate.parse(parts[0]).atStartOfDay().toInstant(ZoneOffset.UTC);
        anchor.setStartedAt(startOfDay);
        anchor.setCreatedAt(Instant.ofEpochMilli(Long.parseLong(parts[1])));
    }

    private String dateCursorOfDisplayedRow(int row) {
        return row == 0 ? null : cursorIssuer.keysetCursor(displayedByDate(row), DATE, DESC).encode();
    }

    private static TimeEntry displayedByDate(int row) {
        return rowReadById(BY_DATE_DESCENDING.get(row - 1));
    }

    private void stubSortResolution(SortInput sort) {
        if (sort == null) {
            when(timeEntryRepository.getDefaultSortField()).thenReturn(DATE);
        } else {
            when(timeEntryRepository.isSortableField(sort.getField())).thenReturn(true);
        }
    }

    private void stubEntryPages(SortInput sort) {
        String sortField = sort == null ? DATE : sort.getField();
        String direction = sort == null ? DESC : sort.getDirection().name();
        stubSortResolution(sort);
        when(timeEntryRepository.findTimeEntriesWithCursor(isNull(), any(CursorPosition.class), anyBoolean(), anyInt(),
                eq(sortField), eq(direction)))
                .thenAnswer(call -> rowsPast(sortField, direction,
                        call.getArgument(1), call.getArgument(2), call.getArgument(3)));
        lenient().when(timeEntryRepository.keysetCursor(any(TimeEntry.class), eq(sortField), eq(direction)))
                .thenAnswer(call -> cursorIssuer.keysetCursor(call.getArgument(0), sortField, direction));
    }
}
