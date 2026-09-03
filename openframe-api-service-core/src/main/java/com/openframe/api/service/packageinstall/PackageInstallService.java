package com.openframe.api.service.packageinstall;

import com.openframe.api.dto.command.BatchRunCommandInput;
import com.openframe.api.dto.packageinstall.InstallPackageInput;
import com.openframe.api.dto.packageinstall.UninstallPackageInput;
import com.openframe.api.dto.packagesearch.PackageDetails;
import com.openframe.api.dto.rmm.DispatchResponse;
import com.openframe.api.exception.DeviceNotFoundException;
import com.openframe.api.service.device.DeviceService;
import com.openframe.api.service.packagesearch.PackageSearchService;
import com.openframe.api.service.rmm.command.CommandDispatchService;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.script.OsType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * Installs / uninstalls software on a managed machine through its OS package
 * manager. The package is resolved in the manager's catalog first, so the
 * dispatched script is built only from catalog data — never from the raw
 * client input.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PackageInstallService {

    // ceiling of the command pipeline (input cap + watchdog stuck-threshold)
    private static final int TIMEOUT_SECONDS = 600;

    private static final Map<PackageManagerType, OsType> MANAGER_OS = Map.of(
            PackageManagerType.BREW, OsType.MAC_OS,
            PackageManagerType.CHOCO, OsType.WINDOWS,
            PackageManagerType.WINGET, OsType.WINDOWS);

    private final DeviceService deviceService;
    private final PackageSearchService packageSearchService;
    private final PackageInstallScriptBuilder packageInstallScriptBuilder;
    private final CommandDispatchService commandDispatchService;

    public DispatchResponse install(InstallPackageInput input, String initiatedBy) {
        requireVersionSupport(input.getPackageManager(), input.getVersion());
        requireOsMatch(input.getMachineId(), input.getPackageManager());
        PackageDetails details = packageSearchService.findPackage(
                input.getPackageManager(), input.getPackageId(), input.getPackageType());
        PackageScript script = packageInstallScriptBuilder.installScript(details, input.getVersion());
        DispatchResponse response = dispatch(input.getMachineId(), script, initiatedBy);
        log.info("Dispatched package install: manager={} packageId={} version={} machineId={} executionId={}",
                input.getPackageManager(), details.getId(), input.getVersion(), input.getMachineId(),
                response.getExecutionId());
        return response;
    }

    public DispatchResponse uninstall(UninstallPackageInput input, String initiatedBy) {
        requireOsMatch(input.getMachineId(), input.getPackageManager());
        PackageDetails details = packageSearchService.findPackage(
                input.getPackageManager(), input.getPackageId(), input.getPackageType());
        PackageScript script = packageInstallScriptBuilder.uninstallScript(details);
        DispatchResponse response = dispatch(input.getMachineId(), script, initiatedBy);
        log.info("Dispatched package uninstall: manager={} packageId={} machineId={} executionId={}",
                input.getPackageManager(), details.getId(), input.getMachineId(), response.getExecutionId());
        return response;
    }

    private static void requireVersionSupport(PackageManagerType packageManager, String version) {
        if (version != null && packageManager == PackageManagerType.BREW) {
            throw new IllegalArgumentException(
                    "Homebrew always installs the latest version — version pinning is not supported for BREW");
        }
    }

    private void requireOsMatch(String machineId, PackageManagerType packageManager) {
        Machine machine = deviceService.findByMachineId(machineId)
                .orElseThrow(() -> new DeviceNotFoundException("Machine not found: " + machineId));
        OsType required = MANAGER_OS.get(packageManager);
        if (machine.getOsType() != required) {
            throw new IllegalArgumentException(packageManager + " packages require a " + required
                    + " machine, but " + machineId + " is " + machine.getOsType());
        }
    }

    private DispatchResponse dispatch(String machineId, PackageScript script, String initiatedBy) {
        BatchRunCommandInput command = new BatchRunCommandInput();
        command.setMachineIds(List.of(machineId));
        command.setCommand(script.code());
        command.setShell(script.shell());
        command.setPrivilegeLevel(script.privilegeLevel());
        command.setTimeoutSeconds(TIMEOUT_SECONDS);
        return commandDispatchService.batchRunCommand(command, initiatedBy);
    }
}
