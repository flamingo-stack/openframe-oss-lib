package com.openframe.api.datafetcher;

import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.dto.timetracking.TimeEntryFilterInput;
import com.openframe.api.service.TimeEntryService;
import com.openframe.core.exception.InvalidCursorException;
import com.openframe.data.document.timetracking.TimeEntry;
import com.openframe.data.repository.cursor.KeysetCursor;
import com.openframe.graphql.relay.RelayIdCodec;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TimeEntryDataFetcherPagingTest {

    private static final String ACTING_USER_ID = "user-1";
    private static final String ROW_1 = "65f1a2b3c4d5e6f708192a10";
    private static final String ROW_2 = "65f1a2b3c4d5e6f708192a20";
    private static final String SEARCH = "printer";
    private static final String INVALID_CURSOR = "Invalid cursor";
    private static final String DATE_VALUE = "2023-11-14_1700000000123";
    private static final KeysetCursor KEYSET = new KeysetCursor("date", Sort.Direction.DESC, DATE_VALUE, ROW_2);
    private static final String KEYSET_PAYLOAD = "k1|date|DESC|" + DATE_VALUE + "|" + ROW_2;
    private static final String OLDER_DATE_CURSOR = DATE_VALUE + "_" + ROW_1;
    private static final SortInput SORT = SortInput.builder().field("date").direction(SortDirection.DESC).build();

    @Mock private TimeEntryService timeEntryService;
    @Spy private RelayIdCodec relayIdCodec = new RelayIdCodec();

    @InjectMocks private TimeEntryDataFetcher dataFetcher;

    @BeforeEach
    void signIn() {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "none")
                .claim("sub", ACTING_USER_ID)
                .build();
        JwtAuthenticationToken authentication = new JwtAuthenticationToken(jwt, AuthorityUtils.NO_AUTHORITIES);
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }

    @AfterEach
    void signOut() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void myTimeEntries_lastAndBeforeNextToFirstAndAfter_backwardPageBeforeTheDecodedCursorReachesTheService() {
        // setup
        String after = CursorCodec.encode(OLDER_DATE_CURSOR);
        String before = KEYSET.encode();
        TimeEntryFilterInput ownEntries = TimeEntryFilterInput.builder().employeeIds(List.of(ACTING_USER_ID)).build();
        CursorPaginationCriteria backwardPage = backwardPage(5, KEYSET_PAYLOAD);
        CountedGenericQueryResult<TimeEntry> noEntries = page(List.of());
        when(timeEntryService.queryEntries(ownEntries, SEARCH, backwardPage, SORT)).thenReturn(noEntries);

        // execution
        dataFetcher.myTimeEntries(null, SEARCH, SORT, 10, after, 5, before);

        // verifications
        verify(timeEntryService).queryEntries(ownEntries, SEARCH, backwardPage, SORT);
    }

    @Test
    void employeeTimeEntries_lastAndBeforeNextToFirstAndAfter_backwardPageBeforeTheDecodedCursorReachesTheService() {
        // setup
        String after = CursorCodec.encode(OLDER_DATE_CURSOR);
        String before = KEYSET.encode();
        TimeEntryFilterInput everyone = TimeEntryFilterInput.builder().build();
        CursorPaginationCriteria backwardPage = backwardPage(5, KEYSET_PAYLOAD);
        CountedGenericQueryResult<TimeEntry> noEntries = page(List.of());
        when(timeEntryService.queryEntries(everyone, SEARCH, backwardPage, SORT)).thenReturn(noEntries);

        // execution
        dataFetcher.employeeTimeEntries(everyone, SEARCH, SORT, 10, after, 5, before);

        // verifications
        verify(timeEntryService).queryEntries(everyone, SEARCH, backwardPage, SORT);
    }

    @Test
    void employeeTimeEntries_lastWithoutBefore_backwardPageWithoutACursorReachesTheService() {
        // setup
        TimeEntryFilterInput everyone = TimeEntryFilterInput.builder().build();
        CursorPaginationCriteria lastPage = backwardPage(5, null);
        CountedGenericQueryResult<TimeEntry> noEntries = page(List.of());
        when(timeEntryService.queryEntries(everyone, null, lastPage, null)).thenReturn(noEntries);

        // execution
        dataFetcher.employeeTimeEntries(everyone, null, null, null, null, 5, null);

        // verifications
        verify(timeEntryService).queryEntries(everyone, null, lastPage, null);
    }

    @Test
    void employeeTimeEntries_firstAndAfterWithAnOlderDateCursor_forwardPageAfterTheDecodedTextReachesTheService() {
        // setup
        String after = CursorCodec.encode(OLDER_DATE_CURSOR);
        TimeEntryFilterInput everyone = TimeEntryFilterInput.builder().build();
        CursorPaginationCriteria forwardPage =
                CursorPaginationCriteria.builder().limit(10).cursor(OLDER_DATE_CURSOR).build();
        CountedGenericQueryResult<TimeEntry> noEntries = page(List.of());
        when(timeEntryService.queryEntries(everyone, null, forwardPage, null)).thenReturn(noEntries);

        // execution
        dataFetcher.employeeTimeEntries(everyone, null, null, 10, after, null, null);

        // verifications
        verify(timeEntryService).queryEntries(everyone, null, forwardPage, null);
    }

    @Test
    void myTimeEntries_beforeThatIsNotBase64_throwsInvalidCursorWithoutCallingTheService() {
        // setup
        String before = "%%%";

        // execution
        Throwable thrown = catchThrowable(() -> dataFetcher.myTimeEntries(null, null, null, null, null, 5, before));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
        verifyNoInteractions(timeEntryService);
    }

    @Test
    void employeeTimeEntries_pageOfEntries_edgeCursorsStayRowIdsAndPageInfoComesFromTheService() {
        // setup
        TimeEntry first = TimeEntry.builder().id(ROW_1).build();
        TimeEntry second = TimeEntry.builder().id(ROW_2).build();
        TimeEntryFilterInput everyone = TimeEntryFilterInput.builder().build();
        CursorPaginationCriteria lastPage = backwardPage(2, null);
        CountedGenericQueryResult<TimeEntry> twoEntries = page(List.of(first, second));
        when(timeEntryService.queryEntries(everyone, null, lastPage, null)).thenReturn(twoEntries);

        // execution
        CountedGenericConnection<GenericEdge<TimeEntry>> connection =
                dataFetcher.employeeTimeEntries(everyone, null, null, null, null, 2, null);

        // verifications
        assertThat(connection.getEdges())
                .extracting(GenericEdge::getCursor)
                .containsExactly(CursorCodec.encode(ROW_1), CursorCodec.encode(ROW_2));
        assertThat(connection.getPageInfo()).isSameAs(twoEntries.getPageInfo());
    }

    private static CursorPaginationCriteria backwardPage(int last, String decodedBefore) {
        return CursorPaginationCriteria.builder().limit(last).cursor(decodedBefore).backward(true).build();
    }

    private static CountedGenericQueryResult<TimeEntry> page(List<TimeEntry> items) {
        PageInfo pageInfo = PageInfo.builder()
                .startCursor(KEYSET.encode())
                .endCursor(KEYSET.encode())
                .hasPreviousPage(true)
                .build();
        return CountedGenericQueryResult.<TimeEntry>builder()
                .items(items)
                .pageInfo(pageInfo)
                .filteredCount(items.size())
                .build();
    }
}
