package com.openframe.api.mapper;

import com.openframe.api.dto.AvailableDeviceEdge;
import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.device.*;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.packagesearch.PackageManagerState;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.tool.ConnectionStatus;
import com.openframe.data.document.tool.ToolConnection;
import com.openframe.data.document.tool.ToolType;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Component
public class GraphQLDeviceMapper {

    public DeviceFilterCriteria toDeviceFilterCriteria(DeviceFilterInput input) {
        if (input == null) {
            return DeviceFilterCriteria.builder().build();
        }

        return DeviceFilterCriteria.builder()
                .statuses(input.getStatuses())
                .deviceTypes(input.getDeviceTypes())
                .osTypes(input.getOsTypes())
                .organizationIds(input.getOrganizationIds())
                .tagKeys(input.getTagKeys())
                .tagValues(input.getTagValues())
                .build();
    }

    public DeviceFilterCriteria toDeviceFilterCriteria(DeviceFilterInput input,
                                                       Collection<PackageManagerType> manageableByPackageManagers) {
        DeviceFilterCriteria criteria = toDeviceFilterCriteria(input);
        criteria.setManageableByPackageManagers(manageableByPackageManagers);
        return criteria;
    }

    public MachinePackageManagersResponse toPackageManagers(Map<PackageManagerType, PackageManagerState> states) {
        if (states == null) {
            return null;
        }
        return MachinePackageManagersResponse.builder()
                .brew(states.get(PackageManagerType.BREW))
                .winget(states.get(PackageManagerType.WINGET))
                .choco(states.get(PackageManagerType.CHOCO))
                .build();
    }

    public DeviceEnrollmentResponse toEnrollment(Machine machine, List<ToolConnection> toolConnections) {
        Instant connectedAt = machine.getFirstConnectedAt();
        Instant inventoryConnectedAt = fleetInventoryConnectedAt(toolConnections);
        return DeviceEnrollmentResponse.builder()
                .registeredAt(machine.getRegisteredAt())
                .connectedAt(connectedAt)
                .inventoryConnectedAt(inventoryConnectedAt)
                .ready(connectedAt != null && inventoryConnectedAt != null)
                .build();
    }

    // Fleet confirmed the host only when the registration transformer stored its numeric host id; the raw UUID means Fleet never answered.
    private static Instant fleetInventoryConnectedAt(List<ToolConnection> toolConnections) {
        if (toolConnections == null) {
            return null;
        }
        return toolConnections.stream()
                .filter(connection -> connection.getToolType() == ToolType.FLEET_MDM)
                .filter(connection -> connection.getStatus() == ConnectionStatus.CONNECTED)
                .filter(connection -> StringUtils.isNumeric(connection.getAgentToolId()))
                .map(ToolConnection::getConnectedAt)
                .findFirst()
                .orElse(null);
    }

    public CursorPaginationCriteria toCursorPaginationCriteria(ConnectionArgs args) {
        return CursorPaginationCriteria.fromConnectionArgs(args);
    }

    public CountedGenericConnection<GenericEdge<Machine>> toDeviceConnection(CountedGenericQueryResult<Machine> result) {
        List<GenericEdge<Machine>> edges = result.getItems().stream()
                .map(machine -> GenericEdge.<Machine>builder()
                        .node(machine)
                        .cursor(CursorCodec.encode(machine.getId()))
                        .build())
                .collect(Collectors.toList());
        return CountedGenericConnection.<GenericEdge<Machine>>builder()
                .edges(edges)
                .pageInfo(result.getPageInfo())
                .filteredCount(result.getFilteredCount())
                .build();
    }

    public CountedGenericConnection<AvailableDeviceEdge> toAvailableDeviceConnection(
            CountedGenericQueryResult<Machine> result, Set<String> assignedMachineIds) {
        List<AvailableDeviceEdge> edges = result.getItems().stream()
                .map(machine -> {
                    boolean assigned = assignedMachineIds.contains(machine.getMachineId());
                    return new AvailableDeviceEdge(machine, availableCursor(machine, assigned), assigned);
                })
                .collect(Collectors.toList());

        PageInfo base = result.getPageInfo();
        PageInfo pageInfo = PageInfo.builder()
                .hasNextPage(base != null && base.isHasNextPage())
                .hasPreviousPage(base != null && base.isHasPreviousPage())
                .startCursor(edges.isEmpty() ? null : edges.get(0).getCursor())
                .endCursor(edges.isEmpty() ? null : edges.get(edges.size() - 1).getCursor())
                .build();

        return CountedGenericConnection.<AvailableDeviceEdge>builder()
                .edges(edges)
                .pageInfo(pageInfo)
                .filteredCount(result.getFilteredCount())
                .build();
    }

    private static String availableCursor(Machine machine, boolean assigned) {
        int bucket = (assigned ? 0 : 2) + (machine.getStatus() == DeviceStatus.ONLINE ? 0 : 1);
        return CursorCodec.encode(bucket + "|" + machine.getId());
    }
}
