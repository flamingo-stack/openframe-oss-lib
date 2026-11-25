package com.openframe.api.service.rmm.osupdate;

import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.rmm.osupdate.DeviceOsUpdateHistoryEntryResponse;
import com.openframe.api.dto.rmm.osupdate.OsUpdateDeviceResponse;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.mapper.DeviceOsResponseMapper;
import com.openframe.api.mapper.OsUpdateResponseMapper;
import com.openframe.api.service.device.DeviceService;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateHistoryEntry;
import com.openframe.data.repository.rmm.osupdate.DeviceOsUpdateHistoryRepository;
import com.openframe.data.repository.rmm.osupdate.InstalledOsUpdateDevice;
import com.openframe.data.repository.rmm.osupdate.OsUpdateDeviceCount;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.List;

// WARNING: client-core has a DeviceOsUpdateHistoryService bean too; the name keeps both in one context
@Service("apiDeviceOsUpdateHistoryService")
@ConditionalOnProperty(name = "openframe.rmm.os-update.enabled", havingValue = "true")
@RequiredArgsConstructor
public class DeviceOsUpdateHistoryService {

    private final DeviceOsUpdateHistoryRepository deviceOsUpdateHistoryRepository;
    private final DeviceService deviceService;
    private final CursorPageAssembler cursorPageAssembler;
    private final DeviceOsResponseMapper deviceOsResponseMapper;
    private final OsUpdateResponseMapper osUpdateResponseMapper;
    private final TenantIdProvider tenantIdProvider;

    public GenericQueryResult<DeviceOsUpdateHistoryEntryResponse> listUpdateHistory(
            String machineId, CursorPaginationCriteria pagination) {
        deviceService.verifyExists(machineId);
        CursorPaginationCriteria normalizedPagination = pagination.normalize();
        List<DeviceOsUpdateHistoryEntry> fetchedEntries = deviceOsUpdateHistoryRepository.findPage(
                tenantIdProvider.getTenantId(), machineId, normalizedPagination.getCursor(),
                normalizedPagination.getLimit() + 1);
        return cursorPageAssembler.toPage(fetchedEntries, normalizedPagination, this::toResponse,
                DeviceOsUpdateHistoryEntryResponse::getCursor);
    }

    // A device that installed an update more than once is counted once. scopeMachineIds null = every device.
    public List<OsUpdateDeviceCount> countInstalledDevicesByIdentifier(List<String> identifiers,
                                                                       List<String> scopeMachineIds) {
        String tenantId = tenantIdProvider.getTenantId();
        return scopeMachineIds == null
                ? deviceOsUpdateHistoryRepository.countInstalledDevicesByIdentifier(tenantId, identifiers)
                : deviceOsUpdateHistoryRepository.countInstalledDevicesByIdentifierOnMachines(
                        tenantId, identifiers, scopeMachineIds);
    }

    public List<String> listInstalledIdentifiers(List<String> machineIds) {
        return deviceOsUpdateHistoryRepository.findInstalledIdentifiersOnMachines(
                tenantIdProvider.getTenantId(), machineIds);
    }

    // One row per device: its latest successful install. scopeMachineIds null = every device.
    public List<OsUpdateDeviceResponse> listOsUpdateDevices(String identifier, List<String> scopeMachineIds,
                                                            String cursor, int limit) {
        List<InstalledOsUpdateDevice> installedDevices = deviceOsUpdateHistoryRepository.findInstalledDevicePage(
                tenantIdProvider.getTenantId(), identifier, scopeMachineIds, cursor, limit);
        return installedDevices.stream()
                .map(this::toOsUpdateDeviceResponse)
                .toList();
    }

    private DeviceOsUpdateHistoryEntryResponse toResponse(DeviceOsUpdateHistoryEntry historyEntry) {
        String rawCursor = deviceOsUpdateHistoryRepository.encodeCursor(historyEntry);
        return deviceOsResponseMapper.toResponse(historyEntry, CursorCodec.encode(rawCursor));
    }

    private OsUpdateDeviceResponse toOsUpdateDeviceResponse(InstalledOsUpdateDevice installedDevice) {
        String rawCursor = deviceOsUpdateHistoryRepository.encodeInstalledDeviceCursor(installedDevice);
        return osUpdateResponseMapper.toInstalledDeviceResponse(installedDevice, CursorCodec.encode(rawCursor));
    }
}
