package com.openframe.api.service.device;

import com.openframe.api.exception.DeviceNotFoundException;
import com.openframe.api.service.rmm.fleet.FleetMdmClientProvider;
import com.openframe.audit.Audited;
import com.openframe.core.exception.BadRequestException;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.tool.ToolConnection;
import com.openframe.data.document.tool.ToolType;
import com.openframe.data.repository.tool.ToolConnectionRepository;
import com.openframe.sdk.fleetmdm.model.WindowsWipeType;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.validation.annotation.Validated;

import java.util.Optional;
import java.util.stream.Stream;

import static com.openframe.data.document.audit.AuditAction.DEVICE_WIPE;
import static org.apache.commons.lang3.StringUtils.isNotBlank;
import static org.apache.commons.lang3.StringUtils.isNumeric;

@Slf4j
@Service
@Validated
@RequiredArgsConstructor
public class DeviceWipeService {

    private final DeviceService deviceService;
    private final ToolConnectionRepository toolConnectionRepository;
    private final FleetMdmClientProvider fleetMdmClientProvider;

    // TODO(CU-17tkuw6a582): keep the wipe on the device (mdm.wipe, WIPE in mdm.availableActions) and take its result from Fleet's wiped_host and failed_wipe activities through CDC
    @Audited(action = DEVICE_WIPE, targetId = "#machineId", storeIfUnchanged = true)
    public Machine wipeWindowsDevice(@NotBlank String machineId, @NotBlank String confirmation) {
        Machine machine = deviceService.findByMachineId(machineId)
                .orElseThrow(() -> new DeviceNotFoundException("Device not found: " + machineId));
        if (!isManagedWindows(machine)) {
            throw new BadRequestException("Only a managed Windows device can be wiped");
        }
        if (!isNameOf(machine, confirmation.strip())) {
            throw new BadRequestException("The confirmation does not match the device's name");
        }
        long hostId = fleetHostId(machine)
                .orElseThrow(() -> new BadRequestException("The device is not connected to Fleet"));
        fleetMdmClientProvider.client().wipeHost(hostId, WindowsWipeType.DO_WIPE_PROTECTED);
        log.info("Wipe requested for machineId={}, Fleet host {}", machineId, hostId);
        return machine;
    }

    private static boolean isManagedWindows(Machine machine) {
        return DeviceStatus.CONNECTED.contains(machine.getStatus()) && machine.getOsType() == OsType.WINDOWS;
    }

    private static boolean isNameOf(Machine machine, String confirmation) {
        return Stream.of(machine.getNickname(), machine.getDisplayName(), machine.getHostname())
                .filter(name -> isNotBlank(name))
                .anyMatch(name -> name.strip().equals(confirmation));
    }

    private Optional<Long> fleetHostId(Machine machine) {
        return toolConnectionRepository.findByMachineIdAndToolType(machine.getMachineId(), ToolType.FLEET_MDM)
                .map(ToolConnection::getAgentToolId)
                .filter(agentToolId -> isNumeric(agentToolId))
                .map(Long::valueOf);
    }
}
