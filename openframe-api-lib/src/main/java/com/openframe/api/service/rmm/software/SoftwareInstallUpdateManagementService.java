package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.script.ScriptResponse;
import com.openframe.api.dto.rmm.software.AdoptSoftwareInput;
import com.openframe.api.dto.rmm.software.SoftwareDispatchResult;
import com.openframe.api.dto.rmm.software.SoftwareManagementInput;
import com.openframe.api.dto.rmm.software.SoftwarePackageInput;
import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.api.service.device.DeviceService;
import com.openframe.api.service.rmm.script.ScriptService;
import com.openframe.core.exception.BadRequestException;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.script.ExecutionSource;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.rmm.script.PrivilegeLevel;
import com.openframe.data.document.rmm.script.RunningExecutionRows;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.document.rmm.software.SoftwareActionResult;
import com.openframe.data.document.rmm.software.SoftwareActionStatus;
import com.openframe.data.document.rmm.software.SoftwareBundlePackage;
import com.openframe.data.document.rmm.software.SoftwareBundleMode;
import com.openframe.data.document.rmm.software.SoftwareScriptCode;
import com.openframe.data.nats.delivery.PackageAdoptReach;
import com.openframe.data.nats.packageupdate.PackageUpdateDispatchService;
import com.openframe.data.repository.rmm.SoftwareActionResultRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.data.service.rmm.MachinePlatformResolver;
import com.openframe.data.service.rmm.software.ChocoPackageOwnership;
import com.openframe.data.service.rmm.software.PackageManagerAvailability;
import com.openframe.data.service.rmm.software.PackageManagerHandler;
import com.openframe.data.service.rmm.software.PackageManagerRegistry;
import com.openframe.data.nats.packageupdate.PackageUpdateEligibilityService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
@ConditionalOnProperty(name = {"spring.cloud.stream.enabled", "openframe.rmm.software.enabled"}, havingValue = "true")
@RequiredArgsConstructor
public class SoftwareInstallUpdateManagementService {

    private final PackageManagerRegistry packageManagerRegistry;
    private final ScriptService scriptService;
    private final SoftwareDispatchService softwareDispatchService;
    private final MachinePlatformResolver machinePlatformResolver;
    private final PackageUpdateEligibilityService packageUpdateEligibility;
    private final PackageUpdateDispatchService packageUpdateDispatchService;
    private final DeviceService deviceService;
    private final SoftwarePackageSelectionResolver softwarePackageSelectionResolver;
    private final SoftwareActionResultRepository softwareActionResultRepository;
    private final TenantIdProvider tenantIdProvider;
    private final PackageAdoptReach packageAdoptReach;
    private final SoftwareInventoryService softwareInventoryService;
    private final PackageManagerAvailability packageManagerAvailability;
    private final ChocoPackageOwnership chocoPackageOwnership;

    public List<SoftwareDispatchResult> install(SoftwareManagementInput input, String initiatedBy, ExecutionSource source) {
        return dispatch(SoftwareAction.INSTALL, input, initiatedBy, source);
    }

    public List<SoftwareDispatchResult> update(SoftwareManagementInput input, String initiatedBy, ExecutionSource source) {
        return dispatch(SoftwareAction.UPDATE, input, initiatedBy, source);
    }

    public List<String> adopt(AdoptSoftwareInput input, String initiatedBy) {
        String softwareId = input.getSoftwareId();
        SoftwareResponse software = softwareInventoryService.getAdoptableSoftware(softwareId);
        SoftwareBundlePackage adoptionPackage = software.getAdoptionPackage();
        PackageManagerType packageManager = adoptionPackage.getPackageManager();
        String packageName = adoptionPackage.getPackageName();
        if (packageManager == PackageManagerType.WINGET) {
            throw new BadRequestException("A program is not adopted into WINGET: winget updates it as it is installed");
        }
        if (packageManager == PackageManagerType.CHOCO) {
            throw new BadRequestException("A program is not adopted into CHOCO: the device agent cannot do it yet");
        }
        List<String> machineIds = input.getMachineIds().stream().distinct().toList();
        List<String> adoptable = adoptableMachines(softwareId, adoptionPackage, machineIds);
        if (adoptable.isEmpty()) {
            throw new BadRequestException("None of the given devices can adopt " + packageName + " with " + packageManager);
        }
        List<String> targets = packageAdoptReach.filterReachable(adoptable);
        if (targets.isEmpty()) {
            throw new BadRequestException("The adopt order reaches none of the given devices: "
                    + DeliveryType.PACKAGE_ADOPT + " is switched off or their agent is too old for it");
        }
        deviceService.verifyDispatchable(targets);

        String executionId = UUID.randomUUID().toString();
        BrewPackageType brewPackageType = adoptionPackage.getBrewPackageType();
        boolean brew = packageManager == PackageManagerType.BREW;
        String adoptScriptId = brew ? SoftwareScriptCode.BREW_ADOPT_SCRIPT_ID : SoftwareScriptCode.CHOCO_ADOPT_SCRIPT_ID;
        PrivilegeLevel adoptPrivilegeLevel = brew ? PrivilegeLevel.USER : PrivilegeLevel.ADMIN;
        String requestId = packageUpdateDispatchService.dispatchAdopt(RunningExecutionRows.builder()
                .executionId(executionId)
                .scriptId(adoptScriptId)
                .machineIds(targets)
                .privilegeLevel(adoptPrivilegeLevel)
                .initiatedBy(initiatedBy)
                .source(ExecutionSource.PACKAGE_INSTALLATION)
                .packageManager(packageManager)
                .packageName(packageName)
                .softwareAction(SoftwareAction.ADOPT)
                .build(), brewPackageType, softwareId, software.getBundleIdentifier());
        SoftwarePackageInput pkg = new SoftwarePackageInput();
        pkg.setPackageManager(packageManager);
        pkg.setPackageName(packageName);
        recordAction(executionId, SoftwareAction.ADOPT, pkg, targets, initiatedBy);

        log.info("Software adopt order sent: requestId={} executionId={} softwareId={} package={}/{} machines={}/{}",
                requestId, executionId, softwareId, packageManager, packageName, targets.size(), machineIds.size());
        return targets;
    }

    private List<String> adoptableMachines(String softwareId, SoftwareBundlePackage adoptionPackage,
                                           List<String> machineIds) {
        PackageManagerType packageManager = adoptionPackage.getPackageManager();
        Map<String, OsType> osTypes = machinePlatformResolver.osTypesByMachineId(machineIds);
        OsType packageOs = SoftwareBundleService.osTypeOf(packageManager);
        Set<OsType> packageOsTypes = Set.of(packageOs);
        List<String> compatible = machinePlatformResolver.compatible(machineIds, osTypes, packageOsTypes);
        List<String> withManager = packageManagerAvailability.adoptableOn(compatible, packageManager);
        return softwareInventoryService.withoutCopiesNotToAdopt(softwareId, adoptionPackage, withManager);
    }

    private List<SoftwareDispatchResult> dispatch(SoftwareAction action, SoftwareManagementInput input,
                                                  String initiatedBy, ExecutionSource source) {
        List<SoftwarePackageInput> packages = input.getPackages();
        softwarePackageSelectionResolver.resolve(packages);
        List<String> machineIds = input.getMachineIds();
        Map<String, OsType> osTypes = machinePlatformResolver.osTypesByMachineId(machineIds);
        Set<String> orderMachines = packageUpdateEligibility.eligibleMachines(action, machineIds);
        Map<SoftwareScriptCode, ScriptResponse> scriptCache = new EnumMap<>(SoftwareScriptCode.class);

        List<SoftwareDispatchResult> results = new ArrayList<>(packages.size());
        for (SoftwarePackageInput pkg : packages) {
            PackageManagerHandler handler = packageManagerRegistry.handlerFor(pkg.getPackageManager());
            SoftwareScriptCode code = handler.scriptCode(action);
            ScriptResponse script = scriptCache.computeIfAbsent(code, scriptService::getSoftwareScript);

            List<String> compatible = machinePlatformResolver.compatible(machineIds, osTypes, script.getSupportedPlatforms());
            List<String> targets = targetsOf(action, pkg, compatible);
            if (targets.isEmpty()) {
                log.warn("Software {} skipped package {}/{}: no compatible device among {} target(s) (supports {})",
                        action, pkg.getPackageManager(), pkg.getPackageName(), machineIds.size(),
                        script.getSupportedPlatforms());
                continue;
            }

            List<String> args = handler.buildArgs(pkg.getPackageName(), pkg.getBrewPackageType());

            List<String> orderTargets = targets.stream().filter(orderMachines::contains).toList();
            List<String> scriptTargets = targets.stream().filter(id -> !orderMachines.contains(id)).toList();
            String executionId = UUID.randomUUID().toString();

            if (!orderTargets.isEmpty()) {
                deviceService.verifyDispatchable(orderTargets);
            }
            if (!scriptTargets.isEmpty()) {
                softwareDispatchService.dispatch(executionId, script, scriptTargets, args, initiatedBy, source,
                        pkg.getPackageManager(), pkg.getPackageName(), action);
            }
            if (!orderTargets.isEmpty()) {
                packageUpdateDispatchService.dispatchAdminUpdateNow(RunningExecutionRows.builder()
                        .executionId(executionId)
                        .scriptId(script.getId())
                        .machineIds(orderTargets)
                        .privilegeLevel(script.getPrivilegeLevel())
                        .timeoutSeconds(script.getDefaultTimeoutSeconds())
                        .initiatedBy(initiatedBy)
                        .source(source)
                        .packageManager(pkg.getPackageManager())
                        .packageName(pkg.getPackageName())
                        .softwareAction(action)
                        .build(), pkg.getBrewPackageType());
            }

            recordAction(executionId, action, pkg, targets, initiatedBy);

            results.add(SoftwareDispatchResult.builder()
                    .packageManager(pkg.getPackageManager())
                    .packageName(pkg.getPackageName())
                    .executionId(executionId)
                    .build());
        }

        log.info("Software {} dispatched: packages={}/{} machines={} initiatedBy={} source={}",
                action, results.size(), packages.size(), machineIds.size(), initiatedBy, source);
        return results;
    }

    private List<String> targetsOf(SoftwareAction action, SoftwarePackageInput pkg, List<String> compatible) {
        PackageManagerType packageManager = pkg.getPackageManager();
        List<String> supporting = machinePlatformResolver.supporting(compatible, packageManager);
        boolean chocoUpdate = packageManager == PackageManagerType.CHOCO && action == SoftwareAction.UPDATE;
        return chocoUpdate ? chocoPackageOwnership.owners(supporting, pkg.getPackageName()) : supporting;
    }

    // the Software Actions list reads its rows from here: no row, no line on the screen
    private void recordAction(String executionId, SoftwareAction action, SoftwarePackageInput pkg,
                              List<String> targets, String initiatedBy) {
        Instant now = Instant.now();
        String tenantId = tenantIdProvider.getTenantId();
        SoftwareActionResult row = SoftwareActionResult.builder()
                .id(executionId)
                .tenantId(tenantId)
                .executionId(executionId)
                .action(action)
                .kind(SoftwareActionKindMapper.kindOf(action))
                .packageManager(pkg.getPackageManager())
                .packageName(pkg.getPackageName())
                .version(pkg.getVersion())
                .status(SoftwareActionStatus.IN_PROGRESS)
                .mode(SoftwareBundleMode.NOW)
                .machineIds(targets)
                .totalMachineCount(targets.size())
                .dispatchedAt(now)
                .initiatedBy(initiatedBy)
                .createdAt(now)
                .build();
        softwareActionResultRepository.save(row);
    }
}
