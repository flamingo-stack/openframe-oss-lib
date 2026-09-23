package com.openframe.api.datafetcher.rmm;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.rmm.software.SoftwareCveSeverity;
import com.openframe.api.dto.rmm.software.SoftwareFilterInput;
import com.openframe.api.dto.rmm.software.SoftwareFilters;
import com.openframe.api.dto.rmm.software.SoftwareOnDeviceFilterInput;
import com.openframe.api.dto.rmm.software.SoftwareOnDeviceFilters;
import com.openframe.api.dto.rmm.software.SoftwareOnDeviceResponse;
import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.api.dto.rmm.software.SoftwareVulnerabilityResponse;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.service.rmm.device.DeviceInventoryService;
import com.openframe.api.service.rmm.software.SoftwareInventoryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;


@DgsComponent
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
@Slf4j
public class SoftwareDataFetcher {

    private final SoftwareInventoryService softwareInventoryService;
    private final DeviceInventoryService deviceInventoryService;

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
        Boolean vulnerable = filter != null && filter.getMinSeverity() != null
                && filter.getMinSeverity() != SoftwareCveSeverity.NONE
                ? Boolean.TRUE : null;
        return PageCursors.toConnection(softwareInventoryService.listSoftware(
                search, page, perPage, sort, vulnerable));
    }

    @DgsQuery
    public CountedGenericConnection<GenericEdge<SoftwareResponse>> deviceSoftware(
            @InputArgument String machineId, @InputArgument SoftwareFilterInput filter,
            @InputArgument Integer first, @InputArgument String after,
            @InputArgument Integer last, @InputArgument String before,
            @InputArgument String search, @InputArgument SortInput sort) {
        int page = PageCursors.decodePage(after != null ? after : before);
        Integer perPage = first != null ? first : last;
        return PageCursors.toConnection(
                deviceInventoryService.listSoftware(machineId, filter, search, page, perPage, sort));
    }

    @DgsQuery
    public CountedGenericConnection<GenericEdge<SoftwareOnDeviceResponse>> softwareDevices(
            @InputArgument String softwareId, @InputArgument SoftwareOnDeviceFilterInput filter,
            @InputArgument Integer first, @InputArgument String after,
            @InputArgument Integer last, @InputArgument String before,
            @InputArgument String search, @InputArgument Object sort) {
        int page = PageCursors.decodePage(after != null ? after : before);
        Integer perPage = first != null ? first : last;
        return PageCursors.toConnection(
                softwareInventoryService.listDevicesForSoftware(softwareId, filter, search, page, perPage));
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
    public SoftwareFilters softwareFilters(@InputArgument Object filter, @InputArgument String search) {
        return softwareInventoryService.getSoftwareFilters(search);
    }

    @DgsQuery
    public SoftwareOnDeviceFilters softwareDeviceFilters(@InputArgument String softwareId,
                                                         @InputArgument Object filter, @InputArgument String search) {
        return softwareInventoryService.getSoftwareDeviceFilters(softwareId, search);
    }
}
