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
import org.springframework.util.StringUtils;
import org.springframework.validation.annotation.Validated;

import java.util.List;
import java.util.stream.Stream;

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
            @InputArgument String machineId,
            @InputArgument List<String> machineIds,
            @InputArgument @Valid DeviceLogFilterInput filter,
            @InputArgument Integer first,
            @InputArgument String after) {

        List<String> devices = devices(machineId, machineIds);
        log.debug("Fetching device logs for machineIds: {}, filter: {}, first: {}, after: {}",
                devices, filter, first, after);

        GenericQueryResult<DeviceLogEntry> result = deviceLogService.queryLogs(
                devices, mapper.toFilterCriteria(filter), mapper.toCursorPaginationCriteria(first, after));
        return mapper.toConnection(result);
    }

    /**
     * Null only when neither argument was given, which is what asks for every device of the tenant. The deprecated
     * single-device argument keeps rejecting a blank value, so a client that sends one still gets its old error
     * rather than a silent tenant-wide query.
     */
    private static List<String> devices(String machineId, List<String> machineIds) {
        if (machineId == null) {
            return machineIds;
        }
        if (!StringUtils.hasText(machineId)) {
            throw new IllegalArgumentException("machineId must not be blank");
        }
        if (machineIds == null) {
            return List.of(machineId);
        }
        return Stream.concat(Stream.of(machineId), machineIds.stream()).toList();
    }
}
