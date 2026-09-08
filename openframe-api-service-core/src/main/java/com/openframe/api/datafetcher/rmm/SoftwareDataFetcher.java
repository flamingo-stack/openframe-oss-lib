package com.openframe.api.datafetcher.rmm;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.rmm.software.SoftwareCveSeverity;
import com.openframe.api.dto.rmm.software.SoftwareFilterInput;
import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.api.dto.rmm.software.SoftwareVulnerabilityResponse;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.service.rmm.software.PageResult;
import com.openframe.api.service.rmm.software.SoftwareInventoryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@DgsComponent
@ConditionalOnProperty(name = "openframe.software-management.enabled", havingValue = "true")
@RequiredArgsConstructor
@Slf4j
public class SoftwareDataFetcher {

    private static final Map<String, String> FLEET_ORDER_KEY = Map.of(
            "name", "name",
            "devicesCount", "hosts_count",
            "hosts_count", "hosts_count");

    private final SoftwareInventoryService softwareInventoryService;

    @DgsQuery
    public SoftwareResponse software(@InputArgument String id) {
        return softwareInventoryService.findById(id).orElse(null);
    }

    @DgsQuery
    public CountedGenericConnection<GenericEdge<SoftwareResponse>> softwares(
            @InputArgument SoftwareFilterInput filter,
            @InputArgument Integer first, @InputArgument String after,
            @InputArgument Integer last, @InputArgument String before,
            @InputArgument String search, @InputArgument SortInput sort) {
        int page = decodePage(after != null ? after : before);
        Integer perPage = first != null ? first : last;
        String orderKey = sort == null ? null : FLEET_ORDER_KEY.get(sort.getField());
        String orderDirection = sort == null || sort.getDirection() == null
                ? null : sort.getDirection().name().toLowerCase(Locale.ROOT);
        Boolean vulnerable = filter != null && filter.getMinSeverity() != null
                && filter.getMinSeverity() != SoftwareCveSeverity.NONE
                ? Boolean.TRUE : null;
        return toConnection(softwareInventoryService.listSoftware(
                search, page, perPage, orderKey, orderDirection, vulnerable));
    }

    @DgsQuery
    public Object softwareDevices(@InputArgument String softwareId, @InputArgument Object filter,
                                  @InputArgument Integer first, @InputArgument String after,
                                  @InputArgument Integer last, @InputArgument String before,
                                  @InputArgument String search, @InputArgument Object sort) {
        log.debug("[software-mgmt stub] softwareDevices query softwareId={}", softwareId);
        return null;
    }

    @DgsQuery
    public CountedGenericConnection<GenericEdge<SoftwareVulnerabilityResponse>> softwareVulnerabilities(
            @InputArgument String softwareId, @InputArgument Object filter,
            @InputArgument Integer first, @InputArgument String after,
            @InputArgument Integer last, @InputArgument String before,
            @InputArgument String search, @InputArgument SortInput sort) {
        int page = decodePage(after != null ? after : before);
        Integer perPage = first != null ? first : last;
        String sortField = sort == null ? null : sort.getField();
        boolean asc = sort != null && sort.getDirection() == SortDirection.ASC;
        return toConnection(softwareInventoryService.listVulnerabilitiesForSoftware(
                softwareId, search, page, perPage, sortField, asc));
    }

    @DgsQuery
    public Object softwareFilters(@InputArgument Object filter, @InputArgument String search) {
        log.debug("[software-mgmt stub] softwareFilters query");
        return null;
    }

    private static int decodePage(String cursor) {
        if (cursor == null || cursor.isBlank()) {
            return 0;
        }
        try {
            return Math.max(0, Integer.parseInt(new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8)));
        } catch (IllegalArgumentException e) {
            log.debug("invalid cursor '{}' — starting from page 0", cursor);
            return 0;
        }
    }

    private static String encodePage(int page) {
        return Base64.getUrlEncoder().withoutPadding()
                .encodeToString(Integer.toString(page).getBytes(StandardCharsets.UTF_8));
    }

    private static <T> CountedGenericConnection<GenericEdge<T>> toConnection(PageResult<T> page) {
        String currentCursor = encodePage(page.page());
        String nextCursor = page.hasNext() ? encodePage(page.page() + 1) : null;
        List<GenericEdge<T>> edges = page.items().stream()
                .map(node -> GenericEdge.<T>builder().node(node).cursor(currentCursor).build())
                .toList();
        PageInfo pageInfo = PageInfo.builder()
                .hasNextPage(page.hasNext())
                .hasPreviousPage(page.hasPrevious())
                .startCursor(edges.isEmpty() ? null : currentCursor)
                .endCursor(nextCursor != null ? nextCursor : (edges.isEmpty() ? null : currentCursor))
                .build();
        return CountedGenericConnection.<GenericEdge<T>>builder()
                .edges(edges)
                .pageInfo(pageInfo)
                .filteredCount(page.filteredCount())
                .build();
    }
}
