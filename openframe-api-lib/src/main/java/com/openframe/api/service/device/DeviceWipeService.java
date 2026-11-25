package com.openframe.api.service.device;

import com.openframe.api.dto.device.DeviceWipe;
import com.openframe.api.dto.device.DeviceWipeStatus;
import com.openframe.api.exception.DeviceNotFoundException;
import com.openframe.api.service.rmm.fleet.FleetMdmClientProvider;
import com.openframe.audit.Audited;
import com.openframe.core.exception.BadRequestException;
import com.openframe.core.exception.ConflictException;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.tool.ToolConnection;
import com.openframe.data.document.tool.ToolType;
import com.openframe.data.repository.tool.ToolConnectionRepository;
import com.openframe.sdk.fleetmdm.FleetMdmClient;
import com.openframe.sdk.fleetmdm.exception.FleetMdmApiException;
import com.openframe.sdk.fleetmdm.exception.FleetMdmException;
import com.openframe.sdk.fleetmdm.model.Host;
import com.openframe.sdk.fleetmdm.model.HostMdm;
import com.openframe.sdk.fleetmdm.model.WindowsWipeType;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.validation.annotation.Validated;

import java.util.Optional;

import static com.openframe.data.document.audit.AuditAction.DEVICE_WIPE;
import static org.apache.commons.lang3.StringUtils.isBlank;
import static org.apache.commons.lang3.StringUtils.isNumeric;

@Slf4j
@Service
@Validated
@RequiredArgsConstructor
public class DeviceWipeService {

    private static final String WINDOWS = "windows";
    private static final String PENDING_WIPE = "wipe";
    private static final String WIPED = "wiped";
    private static final String UNLOCKED = "unlocked";
    private static final int PAYMENT_REQUIRED = 402;
    private static final int CONFLICT = 409;
    private static final int UNPROCESSABLE = 422;

    private final DeviceService deviceService;
    private final ToolConnectionRepository toolConnectionRepository;
    private final FleetMdmClientProvider fleetMdmClientProvider;

    public DeviceWipe getWipe(@NotBlank String machineId) {
        Machine machine = requireMachine(machineId);
        if (!isManaged(machine)) {
            return DeviceWipe.unavailable();
        }
        return fleetHostId(machine)
                .flatMap(hostId -> fleetHost(machineId, hostId))
                .map(DeviceWipeService::wipeOf)
                .orElseGet(DeviceWipe::unavailable);
    }

    private Optional<Host> fleetHost(String machineId, long hostId) {
        try {
            return Optional.ofNullable(fleetMdmClientProvider.client().getHostById(hostId));
        } catch (FleetMdmException e) {
            log.warn("Could not read Fleet host {} of machineId={}, wipe reported unavailable", hostId, machineId, e);
            return Optional.empty();
        }
    }

    @Audited(action = DEVICE_WIPE, targetId = "#machineId", storeIfUnchanged = true)
    public DeviceWipe wipe(@NotBlank String machineId) {
        Machine machine = requireMachine(machineId);
        if (!isManaged(machine)) {
            throw new BadRequestException("Only a managed device can be wiped");
        }
        long hostId = fleetHostId(machine)
                .orElseThrow(() -> new BadRequestException("The device is not connected to Fleet"));
        FleetMdmClient fleet = fleetMdmClientProvider.client();
        Host host = fleet.getHostById(hostId);
        if (host == null) {
            throw new BadRequestException("The device is not connected to Fleet");
        }
        if (!WINDOWS.equals(host.getPlatform())) {
            throw new BadRequestException("Only a Windows device can be wiped");
        }
        try {
            fleet.wipeHost(hostId, WindowsWipeType.DO_WIPE_PROTECTED);
        } catch (FleetMdmApiException e) {
            throw refusalOf(e);
        }
        log.info("Wipe requested for machineId={}, Fleet host {}", machineId, hostId);
        // TODO(CU-17tkuw6a582): keep the wipe request on the device and take its result from Fleet's wiped_host and failed_wipe activities through CDC
        return new DeviceWipe(false, DeviceWipeStatus.PENDING);
    }

    private Machine requireMachine(String machineId) {
        return deviceService.findByMachineId(machineId)
                .orElseThrow(() -> new DeviceNotFoundException("Device not found: " + machineId));
    }

    private static boolean isManaged(Machine machine) {
        return DeviceStatus.CONNECTED.contains(machine.getStatus());
    }

    private Optional<Long> fleetHostId(Machine machine) {
        return toolConnectionRepository.findByMachineIdAndToolType(machine.getMachineId(), ToolType.FLEET_MDM)
                .map(ToolConnection::getAgentToolId)
                .filter(agentToolId -> isNumeric(agentToolId))
                .map(Long::valueOf);
    }

    private static DeviceWipe wipeOf(Host host) {
        HostMdm mdm = host.getMdm();
        if (mdm == null) {
            return DeviceWipe.unavailable();
        }
        DeviceWipeStatus status = statusOf(mdm);
        boolean available = WINDOWS.equals(host.getPlatform())
                && Boolean.TRUE.equals(mdm.getConnectedToFleet())
                && status == DeviceWipeStatus.NOT_REQUESTED
                && UNLOCKED.equals(mdm.getDeviceStatus())
                && isBlank(mdm.getPendingAction());
        return new DeviceWipe(available, status);
    }

    private static DeviceWipeStatus statusOf(HostMdm mdm) {
        if (WIPED.equals(mdm.getDeviceStatus())) {
            return DeviceWipeStatus.WIPED;
        }
        if (PENDING_WIPE.equals(mdm.getPendingAction())) {
            return DeviceWipeStatus.PENDING;
        }
        return DeviceWipeStatus.NOT_REQUESTED;
    }

    private static RuntimeException refusalOf(FleetMdmApiException e) {
        return switch (e.getStatusCode()) {
            case UNPROCESSABLE -> new BadRequestException(
                    "Fleet cannot wipe the device now: it has no MDM turned on, or a lock, unlock or wipe is pending");
            case CONFLICT -> new ConflictException("The device is already wiped");
            case PAYMENT_REQUIRED -> new BadRequestException("This Fleet server cannot wipe Windows devices yet");
            default -> e;
        };
    }
}
