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
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.service.rmm.software.SoftwareInventoryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

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
        int page = PageCursors.decodePage(after != null ? after : before);
        Integer perPage = first != null ? first : last;
        String orderKey = sort == null ? null : FLEET_ORDER_KEY.get(sort.getField());
        String orderDirection = sort == null || sort.getDirection() == null
                ? null : sort.getDirection().name().toLowerCase(Locale.ROOT);
        Boolean vulnerable = filter != null && filter.getMinSeverity() != null
                && filter.getMinSeverity() != SoftwareCveSeverity.NONE
                ? Boolean.TRUE : null;
        return PageCursors.toConnection(softwareInventoryService.listSoftware(
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
        int page = PageCursors.decodePage(after != null ? after : before);
        Integer perPage = first != null ? first : last;
        String sortField = sort == null ? null : sort.getField();
        boolean asc = sort != null && sort.getDirection() == SortDirection.ASC;
        return PageCursors.toConnection(softwareInventoryService.listVulnerabilitiesForSoftware(
                softwareId, search, page, perPage, sortField, asc));
    }

    @DgsQuery
    public Object softwareFilters(@InputArgument Object filter, @InputArgument String search) {
        log.debug("[software-mgmt stub] softwareFilters query");
        return null;
    }
}
