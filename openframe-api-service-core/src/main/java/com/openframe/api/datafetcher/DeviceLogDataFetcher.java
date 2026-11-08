package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.dto.GenericConnection;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.device.DeviceLogEntry;
import com.openframe.api.dto.device.DeviceLogFilterInput;
import com.openframe.api.mapper.GraphQLDeviceLogMapper;
import com.openframe.api.service.device.DeviceLogService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.validation.annotation.Validated;

import java.util.List;

@DgsComponent
@Slf4j
@Validated
@RequiredArgsConstructor
@ConditionalOnProperty(name = "openframe.loki.enabled", havingValue = "true")
public class DeviceLogDataFetcher {

    private final DeviceLogService deviceLogService;
    private final GraphQLDeviceLogMapper mapper;

    @DgsQuery
    public GenericConnection<GenericEdge<DeviceLogEntry>> deviceLogs(
            @InputArgument List<String> machineIds,
            @InputArgument List<String> organizationIds,
            @InputArgument @Valid DeviceLogFilterInput filter,
            @InputArgument Integer first,
            @InputArgument String after) {

        log.debug("Fetching device logs for machineIds: {}, organizationIds: {}, filter: {}, first: {}, after: {}",
                machineIds, organizationIds, filter, first, after);

        GenericQueryResult<DeviceLogEntry> result = deviceLogService.queryLogs(machineIds, organizationIds,
                mapper.toFilterCriteria(filter), mapper.toCursorPaginationCriteria(first, after));
        return mapper.toConnection(result);
    }
}
