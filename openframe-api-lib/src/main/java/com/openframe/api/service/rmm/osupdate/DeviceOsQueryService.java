package com.openframe.api.service.rmm.osupdate;

import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.rmm.osupdate.DeviceOsPendingUpdateResponse;
import com.openframe.api.dto.rmm.osupdate.DeviceOsStateResponse;
import com.openframe.api.dto.rmm.osupdate.DeviceOsUpdateHistoryEntryResponse;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.exception.DeviceNotFoundException;
import com.openframe.api.mapper.DeviceOsResponseMapper;
import com.openframe.data.document.rmm.osupdate.DeviceOsPendingUpdate;
import com.openframe.data.document.rmm.osupdate.DeviceOsState;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateHistoryEntry;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsUpdate;
import com.openframe.data.document.rmm.osupdate.OsUpdateManageability;
import com.openframe.data.document.rmm.osupdate.OsUpdateManageabilityState;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.osupdate.DeviceOsPendingUpdateRepository;
import com.openframe.data.repository.rmm.osupdate.DeviceOsStateRepository;
import com.openframe.data.repository.rmm.osupdate.DeviceOsUpdateHistoryRepository;
import com.openframe.data.repository.rmm.osupdate.OsUpdateRepository;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@ConditionalOnProperty(name = "openframe.rmm.os-update.enabled", havingValue = "true")
@RequiredArgsConstructor
public class DeviceOsQueryService {

    private final MachineRepository machineRepository;
    private final DeviceOsStateRepository deviceOsStateRepository;
    private final DeviceOsPendingUpdateRepository deviceOsPendingUpdateRepository;
    private final OsUpdateRepository osUpdateRepository;
    private final DeviceOsUpdateHistoryRepository deviceOsUpdateHistoryRepository;
    private final DeviceOsResponseMapper deviceOsResponseMapper;
    private final TenantIdProvider tenantIdProvider;

    // null = the device exists and never sent an OS report.
    public DeviceOsStateResponse findOsState(String machineId) {
        verifyDeviceExists(machineId);
        Optional<DeviceOsState> deviceOsState =
                deviceOsStateRepository.findByTenantIdAndMachineId(tenantIdProvider.getTenantId(), machineId);
        return deviceOsState
                .map(deviceOsResponseMapper::toResponse)
                .orElse(null);
    }

    // Updates of a device we cannot manage are not shown as pending: nobody can act on them from here.
    // The stored ones stay, for the day the device becomes manageable.
    public List<DeviceOsPendingUpdateResponse> listPendingUpdates(String machineId) {
        verifyDeviceExists(machineId);
        if (isNotManageable(machineId)) {
            return List.of();
        }
        List<DeviceOsPendingUpdate> pendingUpdates = deviceOsPendingUpdateRepository
                .findByTenantIdAndMachineIdOrderByDiscoveredAtDescIdentifierAsc(tenantIdProvider.getTenantId(), machineId);
        Map<String, OsUpdate> osUpdatesByIdentifier = findOsUpdatesByIdentifier(pendingUpdates);
        return pendingUpdates.stream()
                .filter(pendingUpdate -> osUpdatesByIdentifier.containsKey(pendingUpdate.getIdentifier()))
                .map(pendingUpdate -> deviceOsResponseMapper.toResponse(
                        pendingUpdate, osUpdatesByIdentifier.get(pendingUpdate.getIdentifier())))
                .toList();
    }

    public GenericQueryResult<DeviceOsUpdateHistoryEntryResponse> listUpdateHistory(
            String machineId, CursorPaginationCriteria pagination) {
        verifyDeviceExists(machineId);
        CursorPaginationCriteria normalizedPagination = pagination.normalize();
        int limit = normalizedPagination.getLimit();

        // one entry over the limit tells whether a next page exists
        List<DeviceOsUpdateHistoryEntry> fetchedEntries = deviceOsUpdateHistoryRepository.findPage(
                tenantIdProvider.getTenantId(), machineId, normalizedPagination.getCursor(), limit + 1);
        List<DeviceOsUpdateHistoryEntryResponse> pageEntries = fetchedEntries.stream()
                .limit(limit)
                .map(this::toResponse)
                .toList();
        PageInfo pageInfo = toPageInfo(pageEntries, fetchedEntries.size() > limit, normalizedPagination.hasCursor());

        return GenericQueryResult.<DeviceOsUpdateHistoryEntryResponse>builder()
                .items(pageEntries)
                .pageInfo(pageInfo)
                .build();
    }

    private boolean isNotManageable(String machineId) {
        Optional<DeviceOsState> deviceOsState =
                deviceOsStateRepository.findByTenantIdAndMachineId(tenantIdProvider.getTenantId(), machineId);
        return deviceOsState
                .map(DeviceOsState::getManageability)
                .map(OsUpdateManageability::getState)
                .filter(OsUpdateManageabilityState.NOT_MANAGEABLE::equals)
                .isPresent();
    }

    private void verifyDeviceExists(String machineId) {
        if (machineRepository.findByMachineId(machineId).isEmpty()) {
            throw new DeviceNotFoundException("Device not found: " + machineId);
        }
    }

    // All pending updates of one device are of its one platform.
    private Map<String, OsUpdate> findOsUpdatesByIdentifier(List<DeviceOsPendingUpdate> pendingUpdates) {
        if (pendingUpdates.isEmpty()) {
            return Map.of();
        }
        OsPlatform platform = pendingUpdates.getFirst().getPlatform();
        List<String> identifiers = pendingUpdates.stream()
                .map(DeviceOsPendingUpdate::getIdentifier)
                .toList();
        List<OsUpdate> osUpdates = osUpdateRepository.findByTenantIdAndPlatformAndIdentifierIn(
                tenantIdProvider.getTenantId(), platform, identifiers);
        return osUpdates.stream()
                .collect(Collectors.toMap(OsUpdate::getIdentifier, Function.identity()));
    }

    private DeviceOsUpdateHistoryEntryResponse toResponse(DeviceOsUpdateHistoryEntry historyEntry) {
        String rawCursor = deviceOsUpdateHistoryRepository.encodeCursor(historyEntry);
        return deviceOsResponseMapper.toResponse(historyEntry, CursorCodec.encode(rawCursor));
    }

    private static PageInfo toPageInfo(List<DeviceOsUpdateHistoryEntryResponse> pageEntries,
                                       boolean hasNextPage, boolean hasPreviousPage) {
        String startCursor = pageEntries.isEmpty() ? null : pageEntries.getFirst().getCursor();
        String endCursor = pageEntries.isEmpty() ? null : pageEntries.getLast().getCursor();
        return PageInfo.builder()
                .hasNextPage(hasNextPage)
                .hasPreviousPage(hasPreviousPage)
                .startCursor(startCursor)
                .endCursor(endCursor)
                .build();
    }
}
