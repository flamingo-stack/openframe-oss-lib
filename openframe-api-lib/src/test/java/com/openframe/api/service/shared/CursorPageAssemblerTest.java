package com.openframe.api.service.shared;

import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.assertThat;

class CursorPageAssemblerTest {

    private final CursorPageAssembler cursorPageAssembler = new CursorPageAssembler();

    @Test
    void toPage_oneRowOverTheLimit_pageOfTheLimitWithANextPageAndOnlyThePageRowsMapped() {
        // setup
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().limit(2).build();
        List<String> mapped = new ArrayList<>();
        Function<String, String> toResponse = row -> {
            mapped.add(row);
            return "response-" + row;
        };
        PageInfo expectedPageInfo = PageInfo.builder()
                .hasNextPage(true)
                .hasPreviousPage(false)
                .startCursor("cursor-response-a")
                .endCursor("cursor-response-b")
                .build();

        // execution
        GenericQueryResult<String> page =
                cursorPageAssembler.toPage(List.of("a", "b", "c"), pagination, toResponse, response -> "cursor-" + response);

        // verifications
        assertThat(page.getItems()).containsExactly("response-a", "response-b");
        assertThat(page.getPageInfo()).isEqualTo(expectedPageInfo);
        assertThat(mapped).containsExactly("a", "b");
    }

    @Test
    void toPage_lastPageAfterACursor_noNextPageAndAPreviousOne() {
        // setup
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().limit(2).cursor("raw-0").build();

        // execution
        GenericQueryResult<String> page =
                cursorPageAssembler.toPage(List.of("a"), pagination, Function.identity(), Function.identity());

        // verifications
        assertThat(page.getPageInfo())
                .extracting(PageInfo::isHasNextPage, PageInfo::isHasPreviousPage, PageInfo::getEndCursor)
                .containsExactly(false, true, "a");
    }

    @Test
    void toPage_noRows_emptyPageWithoutCursors() {
        // setup
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().limit(2).build();

        // execution
        GenericQueryResult<String> page =
                cursorPageAssembler.toPage(List.<String>of(), pagination, Function.identity(), Function.identity());

        // verifications
        assertThat(page.getItems()).isEmpty();
        assertThat(page.getPageInfo()).isEqualTo(PageInfo.builder().hasNextPage(false).hasPreviousPage(false).build());
    }
}
