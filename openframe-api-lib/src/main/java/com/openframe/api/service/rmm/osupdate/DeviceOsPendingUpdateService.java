package com.openframe.api.service.rmm.osupdate;

import com.openframe.api.dto.rmm.osupdate.DeviceOsPendingUpdateResponse;
import com.openframe.api.dto.rmm.osupdate.OsUpdateDeviceResponse;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.mapper.DeviceOsResponseMapper;
import com.openframe.api.mapper.OsUpdateResponseMapper;
import com.openframe.api.service.device.DeviceService;
import com.openframe.data.document.rmm.osupdate.DeviceOsPendingUpdate;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsUpdate;
import com.openframe.data.repository.rmm.osupdate.DeviceOsPendingUpdateRepository;
import com.openframe.data.repository.rmm.osupdate.OsUpdateDeviceCount;
import com.openframe.data.repository.rmm.osupdate.OsUpdateIdentifiersOfPlatform;
import com.openframe.data.repository.rmm.osupdate.OsUpdateRepository;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

// WARNING: client-core has a DeviceOsPendingUpdateService bean too; the name keeps both in one context
@Service("apiDeviceOsPendingUpdateService")
@ConditionalOnProperty(name = "openframe.rmm.os-update.enabled", havingValue = "true")
@RequiredArgsConstructor
public class DeviceOsPendingUpdateService {

    private final DeviceOsPendingUpdateRepository deviceOsPendingUpdateRepository;
    // OsUpdateService counts on this service, so it cannot be one of its dependencies
    private final OsUpdateRepository osUpdateRepository;
    private final DeviceOsStateService deviceOsStateService;
    private final DeviceService deviceService;
    private final DeviceOsResponseMapper deviceOsResponseMapper;
    private final OsUpdateResponseMapper osUpdateResponseMapper;
    private final TenantIdProvider tenantIdProvider;

    // Updates of a device we cannot manage are not shown as pending: nobody can act on them from here.
    // The stored ones stay, for the day the device becomes manageable.
    public List<DeviceOsPendingUpdateResponse> listPendingUpdates(String machineId) {
        deviceService.verifyExists(machineId);
        if (deviceOsStateService.isNotManageable(machineId)) {
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

    // Devices we cannot manage are not counted. scopeMachineIds null = every device.
    public List<OsUpdateDeviceCount> countDevicesByIdentifier(OsPlatform platform, List<String> identifiers,
                                                              List<String> scopeMachineIds) {
        String tenantId = tenantIdProvider.getTenantId();
        List<String> notManageableMachineIds = deviceOsStateService.listNotManageableMachineIds();
        if (scopeMachineIds == null) {
            return deviceOsPendingUpdateRepository.countDevicesByIdentifier(
                    platform, identifiers, notManageableMachineIds, tenantId);
        }
        Set<String> notManageable = new HashSet<>(notManageableMachineIds);
        List<String> manageableScopeMachineIds = scopeMachineIds.stream()
                .filter(machineId -> !notManageable.contains(machineId))
                .toList();
        return deviceOsPendingUpdateRepository.countDevicesByIdentifierOnMachines(
                platform, identifiers, manageableScopeMachineIds, tenantId);
    }

    public List<OsUpdateIdentifiersOfPlatform> listIdentifiersByPlatform(List<String> machineIds) {
        return deviceOsPendingUpdateRepository.findIdentifiersByPlatformOnMachines(
                machineIds, tenantIdProvider.getTenantId());
    }

    // Devices we cannot manage are not listed. scopeMachineIds null = every device.
    public List<OsUpdateDeviceResponse> listOsUpdateDevices(OsUpdate osUpdate, List<String> scopeMachineIds,
                                                            String cursor, int limit) {
        List<String> notManageableMachineIds = deviceOsStateService.listNotManageableMachineIds();
        List<DeviceOsPendingUpdate> pendingUpdates = deviceOsPendingUpdateRepository.findDevicePage(
                tenantIdProvider.getTenantId(), osUpdate.getPlatform(), osUpdate.getIdentifier(),
                notManageableMachineIds, scopeMachineIds, cursor, limit);
        return pendingUpdates.stream()
                .map(this::toOsUpdateDeviceResponse)
                .toList();
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

    private OsUpdateDeviceResponse toOsUpdateDeviceResponse(DeviceOsPendingUpdate pendingUpdate) {
        String rawCursor = deviceOsPendingUpdateRepository.encodeDeviceCursor(pendingUpdate);
        return osUpdateResponseMapper.toPendingDeviceResponse(pendingUpdate, CursorCodec.encode(rawCursor));
    }
}
