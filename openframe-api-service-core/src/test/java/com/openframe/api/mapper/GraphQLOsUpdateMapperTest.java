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
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

class GraphQLOsUpdateMapperTest {

    private static final String RAW_CURSOR = "1795142470000|6aff19c07ce86a3f0386ff82";

    private GraphQLOsUpdateMapper mapper;

    @BeforeEach
    void setUp() {
        mapper = new GraphQLOsUpdateMapper();
    }

    @Test
    void toCursorPaginationCriteria_firstAndAfter_forwardPageFromTheDecodedCursor() {
        // setup
        String after = CursorCodec.encode(RAW_CURSOR);

        // execution
        CursorPaginationCriteria pagination = mapper.toCursorPaginationCriteria(50, after);

        // verifications
        assertThat(pagination.getLimit()).isEqualTo(50);
        assertThat(pagination.getCursor()).isEqualTo(RAW_CURSOR);
        assertThat(pagination.isBackward()).isFalse();
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " ", "not base64 !"})
    void toCursorPaginationCriteria_afterAbsentOrNotACursor_firstPage(String after) {
        // setup

        // execution
        CursorPaginationCriteria pagination = mapper.toCursorPaginationCriteria(null, after);

        // verifications
        assertThat(pagination.getLimit()).isNull();
        assertThat(pagination.hasCursor()).isFalse();
    }

    @Test
    void toConnection_historyPage_oneEdgePerEntryWithItsCursorAndThePageInfo() {
        // setup
        DeviceOsUpdateHistoryEntryResponse newer =
                DeviceOsUpdateHistoryEntryResponse.builder().updateKey("k-newer").cursor("cursor-newer").build();
        DeviceOsUpdateHistoryEntryResponse older =
                DeviceOsUpdateHistoryEntryResponse.builder().updateKey("k-older").cursor("cursor-older").build();
        PageInfo pageInfo = PageInfo.builder().hasNextPage(true).endCursor("cursor-older").build();
        GenericQueryResult<DeviceOsUpdateHistoryEntryResponse> page =
                GenericQueryResult.<DeviceOsUpdateHistoryEntryResponse>builder()
                        .items(List.of(newer, older))
                        .pageInfo(pageInfo)
                        .build();

        // execution
        GenericConnection<GenericEdge<DeviceOsUpdateHistoryEntryResponse>> connection = mapper.toConnection(page);

        // verifications
        assertThat(connection.getEdges())
                .extracting(GenericEdge::getNode, GenericEdge::getCursor)
                .containsExactly(tuple(newer, "cursor-newer"), tuple(older, "cursor-older"));
        assertThat(connection.getPageInfo()).isEqualTo(pageInfo);
    }

    @Test
    void toConnection_emptyPage_noEdges() {
        // setup
        PageInfo pageInfo = PageInfo.builder().build();
        GenericQueryResult<DeviceOsUpdateHistoryEntryResponse> page =
                GenericQueryResult.<DeviceOsUpdateHistoryEntryResponse>builder()
                        .items(List.of())
                        .pageInfo(pageInfo)
                        .build();

        // execution
        GenericConnection<GenericEdge<DeviceOsUpdateHistoryEntryResponse>> connection = mapper.toConnection(page);

        // verifications
        assertThat(connection.getEdges()).isEmpty();
        assertThat(connection.getPageInfo()).isEqualTo(pageInfo);
    }
}
