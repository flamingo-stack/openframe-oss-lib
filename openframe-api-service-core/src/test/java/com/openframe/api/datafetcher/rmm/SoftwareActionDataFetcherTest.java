package com.openframe.api.datafetcher.rmm;

import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.rmm.software.SoftwareActionResponse;
import com.openframe.api.dto.shared.PageResult;
import com.openframe.api.service.rmm.software.SoftwareActionDetailService;
import com.openframe.api.service.rmm.software.SoftwareActionService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SoftwareActionDataFetcherTest {

    private static final int PAGE_SIZE = 20;
    private static final String SEARCH = "chrome";
    private static final String AFTER_PAGE_FIVE = PageCursors.encodePage(5);
    private static final String BEFORE_PAGE_TWO = PageCursors.encodePage(2);
    private static final String PAGE_ONE = PageCursors.encodePage(1);

    @Mock private SoftwareActionService softwareActionService;
    @Mock private SoftwareActionDetailService softwareActionDetailService;

    @InjectMocks private SoftwareActionDataFetcher dataFetcher;

    @Test
    void softwareActions_first_theFirstPage() {
        // setup
        SoftwareActionResponse node = SoftwareActionResponse.builder().id("action-1").build();
        PageResult<SoftwareActionResponse> page = new PageResult<>(List.of(node), false, false, 1, 0);
        when(softwareActionService.list(null, SEARCH, null, 0, PAGE_SIZE)).thenReturn(page);

        // execution
        CountedGenericConnection<GenericEdge<SoftwareActionResponse>> result =
                dataFetcher.softwareActions(null, PAGE_SIZE, null, null, null, SEARCH, null);

        // verifications
        assertThat(result.getEdges()).extracting(GenericEdge::getNode).containsExactly(node);
    }

    @Test
    void softwareActions_afterAndBefore_thePageBeforeTheBeforeCursor() {
        // setup
        SoftwareActionResponse node = SoftwareActionResponse.builder().id("action-1").build();
        PageResult<SoftwareActionResponse> page = new PageResult<>(List.of(node), true, true, 60, 1);
        when(softwareActionService.list(null, SEARCH, null, 1, PAGE_SIZE)).thenReturn(page);

        // execution
        CountedGenericConnection<GenericEdge<SoftwareActionResponse>> result =
                dataFetcher.softwareActions(null, null, AFTER_PAGE_FIVE, PAGE_SIZE, BEFORE_PAGE_TWO, SEARCH, null);

        // verifications
        assertThat(result.getEdges()).extracting(GenericEdge::getNode).containsExactly(node);
        assertThat(result.getPageInfo().getStartCursor()).isEqualTo(PAGE_ONE);
    }
}
