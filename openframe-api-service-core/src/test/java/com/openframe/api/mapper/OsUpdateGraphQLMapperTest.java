package com.openframe.api.mapper;

import com.openframe.api.dto.GenericConnection;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.rmm.osupdate.OsUpdateDeviceResponse;
import com.openframe.api.dto.rmm.osupdate.OsUpdateFilterInput;
import com.openframe.api.dto.rmm.osupdate.OsUpdateResponse;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsUpdateClassification;
import com.openframe.data.document.rmm.osupdate.OsUpdateCustomerStatus;
import com.openframe.data.repository.rmm.osupdate.OsUpdateFilter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

class OsUpdateGraphQLMapperTest {

    private OsUpdateGraphQLMapper mapper;
    private PageInfo pageInfo;

    @BeforeEach
    void setUp() {
        mapper = new OsUpdateGraphQLMapper();
        pageInfo = PageInfo.builder().hasNextPage(true).startCursor("cursor-1").endCursor("cursor-2").build();
    }

    @Test
    void toOsUpdateFilter_input_everyValueCarriedOver() {
        // setup
        OsUpdateFilterInput input = OsUpdateFilterInput.builder()
                .platform(OsPlatform.WINDOWS)
                .classifications(List.of(OsUpdateClassification.SECURITY))
                .search("KB5051987")
                .customerStatuses(List.of(OsUpdateCustomerStatus.HELD, OsUpdateCustomerStatus.PILOT))
                .build();
        OsUpdateFilter expected = OsUpdateFilter.builder()
                .platform(OsPlatform.WINDOWS)
                .classifications(List.of(OsUpdateClassification.SECURITY))
                .search("KB5051987")
                .customerStatuses(List.of(OsUpdateCustomerStatus.HELD, OsUpdateCustomerStatus.PILOT))
                .build();

        // execution
        OsUpdateFilter osUpdateFilter = mapper.toOsUpdateFilter(input);

        // verifications
        assertThat(osUpdateFilter).isEqualTo(expected);
    }

    @Test
    void toOsUpdateFilter_noInput_filterThatNarrowsNothing() {
        // setup

        // execution
        OsUpdateFilter osUpdateFilter = mapper.toOsUpdateFilter(null);

        // verifications
        assertThat(osUpdateFilter).isSameAs(OsUpdateFilter.NONE);
    }

    @Test
    void toOrganizationIds_inputWithOrganizations_thoseOrganizations() {
        // setup
        OsUpdateFilterInput input = OsUpdateFilterInput.builder().organizationIds(List.of("org-1")).build();

        // execution
        List<String> organizationIds = mapper.toOrganizationIds(input);

        // verifications
        assertThat(organizationIds).containsExactly("org-1");
    }

    @Test
    void toOrganizationIds_noInputOrNoOrganizations_empty() {
        // setup
        OsUpdateFilterInput withoutOrganizations = OsUpdateFilterInput.builder().search("KB").build();

        // execution
        List<String> ofNoInput = mapper.toOrganizationIds(null);
        List<String> ofNoOrganizations = mapper.toOrganizationIds(withoutOrganizations);

        // verifications
        assertThat(ofNoInput).isEmpty();
        assertThat(ofNoOrganizations).isEmpty();
    }

    @Test
    void toCursorPaginationCriteria_firstAndAfter_forwardPageFromTheDecodedCursor() {
        // setup
        String after = CursorCodec.encode("1795142470000|machine-1");

        // execution
        CursorPaginationCriteria pagination = mapper.toCursorPaginationCriteria(5, after);

        // verifications
        assertThat(pagination)
                .extracting(CursorPaginationCriteria::getLimit, CursorPaginationCriteria::getCursor,
                        CursorPaginationCriteria::isBackward)
                .containsExactly(5, "1795142470000|machine-1", false);
    }

    @Test
    void toCursorPaginationCriteria_neither_firstPageOfTheDefaultSize() {
        // setup

        // execution
        CursorPaginationCriteria pagination = mapper.toCursorPaginationCriteria(null, null);

        // verifications
        assertThat(pagination)
                .extracting(CursorPaginationCriteria::getLimit, CursorPaginationCriteria::getCursor)
                .containsOnlyNulls();
    }

    @Test
    void toOsUpdateConnection_page_oneEdgePerUpdateWithItsCursorAndThePageInfoOfThePage() {
        // setup
        OsUpdateResponse first = OsUpdateResponse.builder().id("id-1").cursor("cursor-1").build();
        OsUpdateResponse second = OsUpdateResponse.builder().id("id-2").cursor("cursor-2").build();
        GenericQueryResult<OsUpdateResponse> osUpdates = GenericQueryResult.<OsUpdateResponse>builder()
                .items(List.of(first, second))
                .pageInfo(pageInfo)
                .build();

        // execution
        GenericConnection<GenericEdge<OsUpdateResponse>> connection = mapper.toOsUpdateConnection(osUpdates);

        // verifications
        assertThat(connection.getEdges())
                .extracting(GenericEdge::getNode, GenericEdge::getCursor)
                .containsExactly(tuple(first, "cursor-1"), tuple(second, "cursor-2"));
        assertThat(connection.getPageInfo()).isSameAs(pageInfo);
    }

    @Test
    void toDeviceConnection_page_oneEdgePerDeviceWithItsCursorAndThePageInfoOfThePage() {
        // setup
        OsUpdateDeviceResponse first = OsUpdateDeviceResponse.builder().machineId("machine-1").cursor("cursor-1").build();
        OsUpdateDeviceResponse second = OsUpdateDeviceResponse.builder().machineId("machine-2").cursor("cursor-2").build();
        GenericQueryResult<OsUpdateDeviceResponse> devices = GenericQueryResult.<OsUpdateDeviceResponse>builder()
                .items(List.of(first, second))
                .pageInfo(pageInfo)
                .build();

        // execution
        GenericConnection<GenericEdge<OsUpdateDeviceResponse>> connection = mapper.toDeviceConnection(devices);

        // verifications
        assertThat(connection.getEdges())
                .extracting(GenericEdge::getNode, GenericEdge::getCursor)
                .containsExactly(tuple(first, "cursor-1"), tuple(second, "cursor-2"));
        assertThat(connection.getPageInfo()).isSameAs(pageInfo);
    }

    @Test
    void toDeviceConnection_emptyPage_noEdges() {
        // setup
        GenericQueryResult<OsUpdateDeviceResponse> devices = GenericQueryResult.<OsUpdateDeviceResponse>builder()
                .items(List.of())
                .pageInfo(pageInfo)
                .build();

        // execution
        GenericConnection<GenericEdge<OsUpdateDeviceResponse>> connection = mapper.toDeviceConnection(devices);

        // verifications
        assertThat(connection.getEdges()).isEmpty();
    }
}
