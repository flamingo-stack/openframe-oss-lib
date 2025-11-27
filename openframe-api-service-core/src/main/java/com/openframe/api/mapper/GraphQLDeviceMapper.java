package com.openframe.api.mapper;

import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.device.*;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.CursorPaginationInput;
import com.openframe.data.document.device.Machine;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
public class GraphQLDeviceMapper {

    public DeviceFilterOptions toDeviceFilterOptions(DeviceFilterInput input) {
        if (input == null) {
            return DeviceFilterOptions.builder().build();
        }

        return DeviceFilterOptions.builder()
                .statuses(input.getStatuses())
                .deviceTypes(input.getDeviceTypes())
                .osTypes(input.getOsTypes())
                .organizationIds(input.getOrganizationIds())
                .tagNames(input.getTagNames())
                .build();
    }

    public CursorPaginationCriteria toCursorPaginationCriteria(CursorPaginationInput input) {
        if (input == null) {
            return new CursorPaginationCriteria();
        }

        return CursorPaginationCriteria.builder()
                .limit(input.getLimit())
                .cursor(input.getCursor())
                .build();
    }

    public CountedGenericConnection<GenericEdge<Machine>> toDeviceConnection(CountedGenericQueryResult<Machine> result) {
        List<GenericEdge<Machine>> edges = result.getItems().stream()
                .map(machine -> GenericEdge.<Machine>builder()
                        .node(machine)
                        .cursor(machine.getMachineId())
                        .build())
                .collect(Collectors.toList());
        return CountedGenericConnection.<GenericEdge<Machine>>builder()
                .edges(edges)
                .pageInfo(result.getPageInfo())
                .filteredCount(result.getFilteredCount())
                .build();
    }
} 