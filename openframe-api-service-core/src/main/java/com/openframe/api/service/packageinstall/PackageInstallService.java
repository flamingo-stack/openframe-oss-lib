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
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.rmm.script.PrivilegeLevel;
import com.openframe.data.document.rmm.script.ScriptShell;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

// the dispatched script is built only from catalog data — raw client input must never reach the shell
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
        PackageManagerType packageManager = input.getPackageManager();
        String machineId = input.getMachineId();
        String version = input.getVersion();
        requireVersionSupport(packageManager, version);
        requireOsMatch(machineId, packageManager);

        String packageId = input.getPackageId();
        BrewPackageType packageType = input.getPackageType();
        PackageDetails details = resolvePackage(packageManager, packageId, packageType);
        PackageScript script = packageInstallScriptBuilder.buildInstallScript(details, version);
        DispatchResponse response = dispatch(machineId, script, initiatedBy);

        log.info("Dispatched package install: manager={} packageId={} version={} machineId={} executionId={}",
                packageManager, details.getId(), version, machineId, response.getExecutionId());
        return response;
    }

    public DispatchResponse uninstall(UninstallPackageInput input, String initiatedBy) {
        PackageManagerType packageManager = input.getPackageManager();
        String machineId = input.getMachineId();
        requireOsMatch(machineId, packageManager);

        String packageId = input.getPackageId();
        BrewPackageType packageType = input.getPackageType();
        PackageDetails details = resolvePackage(packageManager, packageId, packageType);
        PackageScript script = packageInstallScriptBuilder.buildUninstallScript(details);
        DispatchResponse response = dispatch(machineId, script, initiatedBy);

        log.info("Dispatched package uninstall: manager={} packageId={} machineId={} executionId={}",
                packageManager, details.getId(), machineId, response.getExecutionId());
        return response;
    }

    private static void requireVersionSupport(PackageManagerType packageManager, String version) {
        if (isVersionPinnedForBrew(packageManager, version)) {
            throw new IllegalArgumentException(
                    "Homebrew always installs the latest version — version pinning is not supported for BREW");
        }
    }

    private static boolean isVersionPinnedForBrew(PackageManagerType packageManager, String version) {
        return version != null && packageManager == PackageManagerType.BREW;
    }

    private void requireOsMatch(String machineId, PackageManagerType packageManager) {
        Machine machine = deviceService.findByMachineId(machineId)
                .orElseThrow(() -> new DeviceNotFoundException("Machine not found: " + machineId));
        OsType required = MANAGER_OS.get(packageManager);
        OsType actual = machine.getOsType();
        if (actual != required) {
            throw new IllegalArgumentException(packageManager + " packages require a " + required
                    + " machine, but " + machineId + " is " + actual);
        }
    }

    private PackageDetails resolvePackage(PackageManagerType packageManager, String packageId, BrewPackageType packageType) {
        return packageSearchService.findPackage(packageManager, packageId, packageType);
    }

    private DispatchResponse dispatch(String machineId, PackageScript script, String initiatedBy) {
        String code = script.getCode();
        ScriptShell shell = script.getShell();
        PrivilegeLevel privilegeLevel = script.getPrivilegeLevel();
        BatchRunCommandInput command = new BatchRunCommandInput();
        command.setMachineIds(List.of(machineId));
        command.setCommand(code);
        command.setShell(shell);
        command.setPrivilegeLevel(privilegeLevel);
        command.setTimeoutSeconds(TIMEOUT_SECONDS);
        return commandDispatchService.batchRunCommand(command, initiatedBy);
    }
}
