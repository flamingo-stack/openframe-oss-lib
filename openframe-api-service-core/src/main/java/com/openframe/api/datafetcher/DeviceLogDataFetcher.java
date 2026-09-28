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
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.validation.annotation.Validated;

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
            @InputArgument @NotBlank String machineId,
            @InputArgument @Valid DeviceLogFilterInput filter,
            @InputArgument Integer first,
            @InputArgument String after) {

        log.debug("Fetching device logs for machineId: {}, filter: {}, first: {}, after: {}",
                machineId, filter, first, after);

        GenericQueryResult<DeviceLogEntry> result = deviceLogService.queryDeviceLogs(
                machineId, mapper.toFilterCriteria(filter), mapper.toCursorPaginationCriteria(first, after));
        return mapper.toConnection(result);
    }
}
