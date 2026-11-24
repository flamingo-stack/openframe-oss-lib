package com.openframe.api.mapper;

import com.openframe.api.dto.GenericConnection;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.rmm.osupdate.DeviceOsUpdateHistoryEntryResponse;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

class DeviceOsGraphQLMapperTest {

    private DeviceOsGraphQLMapper mapper;

    @BeforeEach
    void setUp() {
        mapper = new DeviceOsGraphQLMapper();
    }

    @Test
    void toCursorPaginationCriteria_firstAndAfter_forwardPageOfThatSizeAfterTheDecodedCursor() {
        // setup
        String after = CursorCodec.encode("1795142470000|6aff19c07ce86a3f0386ff82");

        // execution
        CursorPaginationCriteria pagination = mapper.toCursorPaginationCriteria(50, after);

        // verifications
        assertThat(pagination)
                .extracting(CursorPaginationCriteria::getLimit, CursorPaginationCriteria::getCursor,
                        CursorPaginationCriteria::isBackward)
                .containsExactly(50, "1795142470000|6aff19c07ce86a3f0386ff82", false);
    }

    @Test
    void toCursorPaginationCriteria_neitherFirstNorAfter_firstPageOfTheDefaultSize() {
        // setup

        // execution
        CursorPaginationCriteria pagination = mapper.toCursorPaginationCriteria(null, null);

        // verifications
        assertThat(pagination)
                .extracting(CursorPaginationCriteria::getLimit, CursorPaginationCriteria::getCursor,
                        CursorPaginationCriteria::isBackward)
                .containsExactly(null, null, false);
        assertThat(pagination.normalize().getLimit()).isEqualTo(20);
    }

    @Test
    void toConnection_pageOfEntries_oneEdgePerEntryWithItsCursorAndThePageInfoAsIs() {
        // setup
        DeviceOsUpdateHistoryEntryResponse newer =
                DeviceOsUpdateHistoryEntryResponse.builder().identifier("kb-2").cursor("cursor-2").build();
        DeviceOsUpdateHistoryEntryResponse older =
                DeviceOsUpdateHistoryEntryResponse.builder().identifier("kb-1").cursor("cursor-1").build();
        PageInfo pageInfo = PageInfo.builder().hasNextPage(true).startCursor("cursor-2").endCursor("cursor-1").build();
        GenericQueryResult<DeviceOsUpdateHistoryEntryResponse> updateHistory =
                GenericQueryResult.<DeviceOsUpdateHistoryEntryResponse>builder()
                        .items(List.of(newer, older)).pageInfo(pageInfo).build();

        // execution
        GenericConnection<GenericEdge<DeviceOsUpdateHistoryEntryResponse>> connection =
                mapper.toConnection(updateHistory);

        // verifications
        assertThat(connection.getEdges())
                .extracting(GenericEdge::getNode, GenericEdge::getCursor)
                .containsExactly(tuple(newer, "cursor-2"), tuple(older, "cursor-1"));
        assertThat(connection.getPageInfo()).isSameAs(pageInfo);
    }

    @Test
    void toConnection_emptyPage_noEdges() {
        // setup
        PageInfo pageInfo = PageInfo.builder().build();
        GenericQueryResult<DeviceOsUpdateHistoryEntryResponse> updateHistory =
                GenericQueryResult.<DeviceOsUpdateHistoryEntryResponse>builder()
                        .items(List.of()).pageInfo(pageInfo).build();

        // execution
        GenericConnection<GenericEdge<DeviceOsUpdateHistoryEntryResponse>> connection =
                mapper.toConnection(updateHistory);

        // verifications
        assertThat(connection.getEdges()).isEmpty();
        assertThat(connection.getPageInfo()).isSameAs(pageInfo);
    }
}
