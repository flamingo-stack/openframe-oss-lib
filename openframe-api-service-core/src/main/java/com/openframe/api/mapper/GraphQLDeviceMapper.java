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
import org.springframework.stereotype.Component;

import java.util.List;
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
