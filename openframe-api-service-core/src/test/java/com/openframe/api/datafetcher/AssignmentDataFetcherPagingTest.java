package com.openframe.api.datafetcher;

import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.mapper.GraphQLAssignmentMapper;
import com.openframe.api.service.AssignmentService;
import com.openframe.core.exception.InvalidCursorException;
import com.openframe.data.document.assignment.AssignmentTargetType;
import com.openframe.data.document.assignment.ItemAssignment;
import com.openframe.data.repository.cursor.KeysetCursor;
import com.openframe.graphql.relay.NodeType;
import com.openframe.graphql.relay.RelayIdCodec;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Sort;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AssignmentDataFetcherPagingTest {

    private static final String RAW_ITEM_ID = "item-1";
    private static final String ITEM_ID = new RelayIdCodec().encode(NodeType.TICKET, RAW_ITEM_ID);
    private static final AssignmentTargetType TARGET_TYPE = AssignmentTargetType.DEVICE;
    private static final String ROW_1 = "65f1a2b3c4d5e6f708192a10";
    private static final String ROW_2 = "65f1a2b3c4d5e6f708192a20";
    private static final String SEARCH = "ws";
    private static final String INVALID_CURSOR = "Invalid cursor";
    private static final Instant CREATED_AT = Instant.ofEpochMilli(1_700_000_000_123L);
    private static final KeysetCursor KEYSET = KeysetCursor.ofInstant("createdAt", Sort.Direction.DESC, CREATED_AT, ROW_2);
    private static final String KEYSET_PAYLOAD = "k1|createdAt|DESC|1700000000123|" + ROW_2;
    private static final SortInput SORT = SortInput.builder().field("createdAt").direction(SortDirection.DESC).build();

    @Mock private AssignmentService assignmentService;
    @Spy private GraphQLAssignmentMapper mapper = new GraphQLAssignmentMapper();
    @Spy private RelayIdCodec relayIdCodec = new RelayIdCodec();

    @InjectMocks private AssignmentDataFetcher dataFetcher;

    @Test
    void assignedItems_lastAndBeforeNextToFirstAndAfter_backwardPageBeforeTheDecodedCursorReachesTheService() {
        // setup
        String after = CursorCodec.encode(ROW_1);
        String before = KEYSET.encode();
        CursorPaginationCriteria backwardPage = CursorPaginationCriteria.builder()
                .limit(5)
                .cursor(KEYSET_PAYLOAD)
                .backward(true)
                .build();
        CountedGenericQueryResult<ItemAssignment> noAssignments = page(List.of());
        when(assignmentService.queryAssignments(RAW_ITEM_ID, TARGET_TYPE, backwardPage, SEARCH, SORT))
                .thenReturn(noAssignments);

        // execution
        dataFetcher.assignedItems(ITEM_ID, TARGET_TYPE, SEARCH, SORT, 10, after, 5, before);

        // verifications
        verify(assignmentService).queryAssignments(RAW_ITEM_ID, TARGET_TYPE, backwardPage, SEARCH, SORT);
    }

    @Test
    void assignedItems_lastWithoutBefore_backwardPageWithoutACursorReachesTheService() {
        // setup
        CursorPaginationCriteria lastPage = CursorPaginationCriteria.builder().limit(5).backward(true).build();
        CountedGenericQueryResult<ItemAssignment> noAssignments = page(List.of());
        when(assignmentService.queryAssignments(RAW_ITEM_ID, TARGET_TYPE, lastPage, null, null))
                .thenReturn(noAssignments);

        // execution
        dataFetcher.assignedItems(ITEM_ID, TARGET_TYPE, null, null, null, null, 5, null);

        // verifications
        verify(assignmentService).queryAssignments(RAW_ITEM_ID, TARGET_TYPE, lastPage, null, null);
    }

    @Test
    void assignedItems_firstAndAfter_forwardPageAfterTheDecodedCursorReachesTheService() {
        // setup
        String after = CursorCodec.encode(ROW_1);
        CursorPaginationCriteria forwardPage = CursorPaginationCriteria.builder().limit(10).cursor(ROW_1).build();
        CountedGenericQueryResult<ItemAssignment> noAssignments = page(List.of());
        when(assignmentService.queryAssignments(RAW_ITEM_ID, TARGET_TYPE, forwardPage, null, null))
                .thenReturn(noAssignments);

        // execution
        dataFetcher.assignedItems(ITEM_ID, TARGET_TYPE, null, null, 10, after, null, null);

        // verifications
        verify(assignmentService).queryAssignments(RAW_ITEM_ID, TARGET_TYPE, forwardPage, null, null);
    }

    @Test
    void assignedItems_beforeThatIsNotBase64_throwsInvalidCursorWithoutCallingTheService() {
        // setup
        String before = "%%%";

        // execution
        Throwable thrown = catchThrowable(
                () -> dataFetcher.assignedItems(ITEM_ID, TARGET_TYPE, null, null, null, null, 5, before));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
        verifyNoInteractions(assignmentService);
    }

    @Test
    void assignedItems_pageOfAssignments_edgeCursorsStayRowIdsAndPageInfoComesFromTheService() {
        // setup
        ItemAssignment first = ItemAssignment.builder().id(ROW_1).build();
        ItemAssignment second = ItemAssignment.builder().id(ROW_2).build();
        CountedGenericQueryResult<ItemAssignment> twoAssignments = page(List.of(first, second));
        CursorPaginationCriteria lastPage = CursorPaginationCriteria.builder().limit(2).backward(true).build();
        when(assignmentService.queryAssignments(RAW_ITEM_ID, TARGET_TYPE, lastPage, null, null))
                .thenReturn(twoAssignments);

        // execution
        CountedGenericConnection<GenericEdge<ItemAssignment>> connection =
                dataFetcher.assignedItems(ITEM_ID, TARGET_TYPE, null, null, null, null, 2, null);

        // verifications
        assertThat(connection.getEdges())
                .extracting(GenericEdge::getCursor)
                .containsExactly(CursorCodec.encode(ROW_1), CursorCodec.encode(ROW_2));
        assertThat(connection.getPageInfo()).isSameAs(twoAssignments.getPageInfo());
    }

    private static CountedGenericQueryResult<ItemAssignment> page(List<ItemAssignment> items) {
        PageInfo pageInfo = PageInfo.builder()
                .startCursor(KEYSET.encode())
                .endCursor(KEYSET.encode())
                .hasPreviousPage(true)
                .build();
        return CountedGenericQueryResult.<ItemAssignment>builder()
                .items(items)
                .pageInfo(pageInfo)
                .filteredCount(items.size())
                .build();
    }
}
