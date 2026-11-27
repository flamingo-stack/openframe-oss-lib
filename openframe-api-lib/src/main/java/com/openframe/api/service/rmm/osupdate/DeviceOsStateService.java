package com.openframe.api.service.rmm.osupdate;

import com.openframe.api.dto.rmm.osupdate.DeviceOsStateResponse;
import com.openframe.api.mapper.DeviceOsResponseMapper;
import com.openframe.api.service.device.DeviceService;
import com.openframe.data.document.rmm.osupdate.DeviceOsState;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsUpdateManageability;
import com.openframe.data.document.rmm.osupdate.OsUpdateManageabilityState;
import com.openframe.data.repository.rmm.osupdate.DeviceOsStateRepository;
import com.openframe.data.repository.rmm.osupdate.ManageableOsDeviceCounts;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

// WARNING: client-core has a DeviceOsStateService bean too; the name keeps both in one context
@Service("apiDeviceOsStateService")
@ConditionalOnProperty(name = "openframe.rmm.os-update.enabled", havingValue = "true")
@RequiredArgsConstructor
public class DeviceOsStateService {

    private final DeviceOsStateRepository deviceOsStateRepository;
    private final DeviceService deviceService;
    private final DeviceOsResponseMapper deviceOsResponseMapper;
    private final TenantIdProvider tenantIdProvider;

    // null = the device exists and never sent an OS report.
    public DeviceOsStateResponse findOsState(String machineId) {
        deviceService.verifyExists(machineId);
        Optional<DeviceOsState> deviceOsState =
                deviceOsStateRepository.findByTenantIdAndMachineId(tenantIdProvider.getTenantId(), machineId);
        return deviceOsState
                .map(deviceOsResponseMapper::toResponse)
                .orElse(null);
    }

    public boolean isNotManageable(String machineId) {
        Optional<DeviceOsState> deviceOsState =
                deviceOsStateRepository.findByTenantIdAndMachineId(tenantIdProvider.getTenantId(), machineId);
        return deviceOsState
                .map(DeviceOsState::getManageability)
                .map(OsUpdateManageability::getState)
                .filter(OsUpdateManageabilityState.NOT_MANAGEABLE::equals)
                .isPresent();
    }

    // scopeMachineIds null = every device.
    public ManageableOsDeviceCounts countManageableDevices(OsPlatform platform, List<String> scopeMachineIds) {
        return deviceOsStateRepository.countManageableDevices(
                tenantIdProvider.getTenantId(), platform, scopeMachineIds);
    }

    public List<String> listNotManageableMachineIds() {
        List<DeviceOsState> notManageableStates = deviceOsStateRepository.findByTenantIdAndManageabilityState(
                tenantIdProvider.getTenantId(), OsUpdateManageabilityState.NOT_MANAGEABLE);
        return notManageableStates.stream()
                .map(DeviceOsState::getMachineId)
                .toList();
    }
}
