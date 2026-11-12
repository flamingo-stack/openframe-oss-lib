package com.openframe.api.datafetcher.rmm;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsData;
import com.netflix.graphql.dgs.DgsDataFetchingEnvironment;
import com.netflix.graphql.dgs.DgsMutation;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.rmm.software.SoftwareAutoUpdatePolicyResponse;
import com.openframe.api.dto.rmm.software.SoftwareCveSeverity;
import com.openframe.api.dto.rmm.software.SoftwareFilterInput;
import com.openframe.api.dto.rmm.software.SoftwareFilters;
import com.openframe.api.dto.rmm.software.SoftwareOnDeviceFilterInput;
import com.openframe.api.dto.rmm.software.SoftwareOnDeviceFilters;
import com.openframe.api.dto.rmm.software.SoftwareOnDeviceResponse;
import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.api.dto.rmm.software.SoftwareVulnerabilityFilterInput;
import com.openframe.api.dto.rmm.software.SoftwareVulnerabilityResponse;
import com.openframe.api.dto.rmm.software.TurnOnSoftwareAutoUpdateInput;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.service.rmm.fleet.FleetSoftwareOs;
import com.openframe.api.service.rmm.software.SoftwareAutoUpdateService;
import com.openframe.api.service.rmm.software.SoftwareBundleService;
import com.openframe.api.service.rmm.software.SoftwareInventoryService;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.rmm.software.FleetSource;
import com.openframe.graphql.relay.RelayIdCodec;
import com.openframe.security.authentication.AuthPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;

import static com.openframe.graphql.relay.NodeType.SOFTWARE_BUNDLE;

@DgsComponent
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
@Slf4j
@Validated
public class SoftwareDataFetcher {

    private final SoftwareInventoryService softwareInventoryService;
    private final SoftwareAutoUpdateService softwareAutoUpdateService;
    private final SoftwareBundleService softwareBundleService;
    private final RelayIdCodec relayIdCodec;

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
        int perPage = PageCursors.pageSize(first, last);
        Boolean vulnerable = filter != null && filter.getMinSeverity() != null
                && filter.getMinSeverity() != SoftwareCveSeverity.NONE
                ? Boolean.TRUE : null;
        return PageCursors.toConnection(softwareInventoryService.listSoftware(
                search, page, perPage, sort, vulnerable, filter));
    }

    @DgsData(parentType = "Software", field = "os")
    public OsType softwareOs(DgsDataFetchingEnvironment dfe) {
        SoftwareResponse software = dfe.getSource();
        FleetSource fleetSource = software.getFleetSource();
        return FleetSoftwareOs.of(fleetSource);
    }

    @DgsQuery
    public CountedGenericConnection<GenericEdge<SoftwareResponse>> deviceSoftware(
            @InputArgument String machineId, @InputArgument SoftwareFilterInput filter,
            @InputArgument Integer first, @InputArgument String after,
            @InputArgument Integer last, @InputArgument String before,
            @InputArgument String search, @InputArgument SortInput sort) {
        int page = PageCursors.decodePage(after != null ? after : before);
        int perPage = PageCursors.pageSize(first, last);
        return PageCursors.toConnection(
                softwareInventoryService.listSoftwareForDevice(machineId, filter, search, page, perPage, sort));
    }

    @DgsQuery
    public CountedGenericConnection<GenericEdge<SoftwareOnDeviceResponse>> softwareDevices(
            @InputArgument String softwareId, @InputArgument SoftwareOnDeviceFilterInput filter,
            @InputArgument Integer first, @InputArgument String after,
            @InputArgument Integer last, @InputArgument String before,
            @InputArgument String search, @InputArgument SortInput sort) {
        int page = PageCursors.decodePage(after != null ? after : before);
        int perPage = PageCursors.pageSize(first, last);
        return PageCursors.toConnection(
                softwareInventoryService.listDevicesForSoftware(softwareId, filter, search, page, perPage, sort));
    }

    @DgsQuery
    public CountedGenericConnection<GenericEdge<SoftwareVulnerabilityResponse>> softwareVulnerabilities(
            @InputArgument String softwareId, @InputArgument SoftwareVulnerabilityFilterInput filter,
            @InputArgument Integer first, @InputArgument String after,
            @InputArgument Integer last, @InputArgument String before,
            @InputArgument String search, @InputArgument SortInput sort) {
        int page = PageCursors.decodePage(after != null ? after : before);
        int perPage = PageCursors.pageSize(first, last);
        String sortField = sort == null ? null : sort.getField();
        boolean asc = sort != null && sort.getDirection() == SortDirection.ASC;
        return PageCursors.toConnection(softwareInventoryService.listVulnerabilitiesForSoftware(
                softwareId, filter, search, page, perPage, sortField, asc));
    }

    @DgsQuery
    public SoftwareFilters softwareFilters(@InputArgument Object filter, @InputArgument String search) {
        return softwareInventoryService.getSoftwareFilters(search);
    }

    @DgsQuery
    public SoftwareFilters deviceSoftwareFilters(@InputArgument String machineId, @InputArgument Object filter,
                                                 @InputArgument String search) {
        return softwareInventoryService.getDeviceSoftwareFilters(machineId, search);
    }

    @DgsQuery
    public SoftwareOnDeviceFilters softwareDeviceFilters(@InputArgument String softwareId,
                                                         @InputArgument Object filter, @InputArgument String search) {
        return softwareInventoryService.getSoftwareDeviceFilters(softwareId, search);
    }

    @DgsQuery
    public SoftwareAutoUpdatePolicyResponse softwareAutoUpdatePolicy(@InputArgument String softwareId) {
        return softwareAutoUpdateService.getPolicy(softwareId);
    }

    @DgsMutation
    public SoftwareResponse turnOnSoftwareAutoUpdate(@InputArgument @Valid TurnOnSoftwareAutoUpdateInput input) {
        String bundleGlobalId = input.getBundleId();
        String bundleId = relayIdCodec.decode(bundleGlobalId, SOFTWARE_BUNDLE);
        input.setBundleId(bundleId);
        String userId = getCurrentUserId();
        return softwareBundleService.turnOnAutoUpdate(input, userId);
    }

    @DgsMutation
    public SoftwareResponse turnOffSoftwareAutoUpdate(@InputArgument String softwareId) {
        return softwareInventoryService.turnOffAutoUpdate(softwareId, getCurrentUserId());
    }

    private String getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return AuthPrincipal.fromJwt((Jwt) auth.getPrincipal()).getId();
    }
}
