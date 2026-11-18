package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.script.ScriptResponse;
import com.openframe.api.dto.rmm.software.AdoptSoftwareInput;
import com.openframe.api.dto.rmm.software.SoftwareDispatchResult;
import com.openframe.api.dto.rmm.software.SoftwareManagementInput;
import com.openframe.api.dto.rmm.software.SoftwarePackageInput;
import com.openframe.api.service.device.DeviceService;
import com.openframe.api.service.rmm.script.ScriptService;
import com.openframe.core.exception.BadRequestException;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.script.ExecutionSource;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.rmm.script.RunningExecutionRows;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.document.rmm.software.SoftwareActionResult;
import com.openframe.data.document.rmm.software.SoftwareActionStatus;
import com.openframe.data.document.rmm.software.SoftwareAdoption;
import com.openframe.data.document.rmm.software.SoftwareAdoptionStatus;
import com.openframe.data.document.rmm.software.SoftwareBundlePackage;
import com.openframe.data.document.rmm.software.SoftwareBundleMode;
import com.openframe.data.document.rmm.software.SoftwareScriptCode;
import com.openframe.data.nats.delivery.PackageAdoptDeliverySeed;
import com.openframe.data.nats.delivery.route.DeliveryRouter;
import com.openframe.data.nats.packageupdate.PackageReference;
import com.openframe.data.nats.packageupdate.PackageUpdateDispatchService;
import com.openframe.data.nats.packageupdate.PackageUpdateWire;
import com.openframe.data.repository.rmm.SoftwareActionResultRepository;
import com.openframe.data.repository.rmm.SoftwareAdoptionRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.data.service.rmm.MachinePlatformResolver;
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
    private final DeliveryRouter deliveryRouter;
    private final SoftwareInventoryService softwareInventoryService;
    private final PackageManagerAvailability packageManagerAvailability;
    private final SoftwareAdoptionRepository softwareAdoptionRepository;

    public List<SoftwareDispatchResult> install(SoftwareManagementInput input, String initiatedBy, ExecutionSource source) {
        return dispatch(SoftwareAction.INSTALL, input, initiatedBy, source);
    }

    public List<SoftwareDispatchResult> update(SoftwareManagementInput input, String initiatedBy, ExecutionSource source) {
        return dispatch(SoftwareAction.UPDATE, input, initiatedBy, source);
    }

    public List<String> adopt(AdoptSoftwareInput input) {
        String softwareId = input.getSoftwareId();
        SoftwareBundlePackage adoptionPackage = softwareInventoryService.getAdoptionPackage(softwareId);
        PackageManagerType packageManager = adoptionPackage.getPackageManager();
        String packageName = adoptionPackage.getPackageName();
        if (packageManager == PackageManagerType.WINGET) {
            throw new BadRequestException("A program is not adopted into WINGET: winget updates it as it is installed");
        }
        List<String> machineIds = input.getMachineIds().stream().distinct().toList();
        List<String> targets = adoptableMachines(machineIds, packageManager);
        if (targets.isEmpty()) {
            throw new BadRequestException("None of the given devices can adopt " + packageName + " with " + packageManager);
        }
        requireAdoptOrderReaches(targets);
        deviceService.verifyDispatchable(targets);

        String requestId = UUID.randomUUID().toString();
        recordAdoptions(targets, softwareId, adoptionPackage, requestId);
        BrewPackageType brewPackageType = adoptionPackage.getBrewPackageType();
        PackageReference packageRef = PackageUpdateWire.reference(packageManager, packageName, brewPackageType);
        targets.stream()
                .map(machineId -> PackageAdoptDeliverySeed.builder()
                        .machineId(machineId)
                        .requestId(requestId)
                        .packageRef(packageRef)
                        .build())
                .forEach(deliveryRouter::dispatch);

        log.info("Software adopt order sent: requestId={} softwareId={} package={}/{} machines={}/{}",
                requestId, softwareId, packageManager, packageName, targets.size(), machineIds.size());
        return targets;
    }

    private List<String> adoptableMachines(List<String> machineIds, PackageManagerType packageManager) {
        Map<String, OsType> osTypes = machinePlatformResolver.osTypesByMachineId(machineIds);
        OsType packageOs = SoftwareBundleService.osTypeOf(packageManager);
        Set<OsType> packageOsTypes = Set.of(packageOs);
        List<String> compatible = machinePlatformResolver.compatible(machineIds, osTypes, packageOsTypes);
        return packageManagerAvailability.adoptableOn(compatible, packageManager);
    }

    private void requireAdoptOrderReaches(List<String> machineIds) {
        Set<String> reachable = deliveryRouter.reachable(DeliveryType.PACKAGE_ADOPT, machineIds);
        List<String> unreachable = machineIds.stream().filter(machineId -> !reachable.contains(machineId)).toList();
        if (!unreachable.isEmpty()) {
            throw new BadRequestException("The adopt order cannot reach devices " + unreachable + ": "
                    + DeliveryType.PACKAGE_ADOPT + " is switched off or their agent is too old for it");
        }
    }

    // the id is the device and the title: saving a repeated adoption replaces the earlier record
    private void recordAdoptions(List<String> machineIds, String softwareId, SoftwareBundlePackage adoptionPackage,
                                 String requestId) {
        String tenantId = tenantIdProvider.getTenantId();
        PackageManagerType packageManager = adoptionPackage.getPackageManager();
        String packageName = adoptionPackage.getPackageName();
        Instant now = Instant.now();
        List<SoftwareAdoption> adoptions = machineIds.stream()
                .map(machineId -> SoftwareAdoption.builder()
                        .id(machineId + ":" + softwareId)
                        .tenantId(tenantId)
                        .machineId(machineId)
                        .softwareId(softwareId)
                        .packageManager(packageManager)
                        .packageName(packageName)
                        .requestId(requestId)
                        .status(SoftwareAdoptionStatus.ADOPTING)
                        .createdAt(now)
                        .build())
                .toList();
        softwareAdoptionRepository.saveAll(adoptions);
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
            List<String> targets = machinePlatformResolver.supporting(compatible, pkg.getPackageManager());
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
                .kind(action.kind())
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
