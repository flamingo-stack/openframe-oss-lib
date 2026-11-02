package com.openframe.client.service.rmm;

import com.openframe.data.document.rmm.schedule.SoftwareSchedule;
import com.openframe.data.document.rmm.schedule.SoftwareSchedulePackage;
import com.openframe.data.document.rmm.script.DeliveryChannel;
import com.openframe.data.document.rmm.script.ExecutionSource;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.rmm.script.RunningExecutionRows;
import com.openframe.data.document.rmm.script.Script;
import com.openframe.data.document.rmm.script.ScriptType;
import com.openframe.data.document.rmm.software.SoftwareExecutionId;
import com.openframe.data.document.rmm.software.SoftwareScriptCode;
import com.openframe.data.nats.packageupdate.PackageUpdateDispatchService;
import com.openframe.data.nats.rmm.model.ScriptMessage;
import com.openframe.data.nats.rmm.publisher.SoftwareNatsPublisher;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import com.openframe.data.repository.rmm.ScriptRepository;
import com.openframe.data.service.rmm.MachinePlatformResolver;
import com.openframe.data.service.rmm.software.PackageAutoUpdatePolicyService;
import com.openframe.data.service.rmm.software.PackageManagerHandler;
import com.openframe.data.service.rmm.software.PackageManagerRegistry;
import com.openframe.data.service.rmm.software.PackageUpdateEligibilityService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Component
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
@Slf4j
public class SoftwareScheduleFireDispatcher {

    private final ScriptRepository scriptRepository;
    private final PackageManagerRegistry packageManagerRegistry;
    private final ScriptExecutionRepository scriptExecutionRepository;
    private final SoftwareNatsPublisher softwareNatsPublisher;
    private final ScriptDeliveryRetryStore retryStore;
    private final MachinePlatformResolver machinePlatformResolver;
    private final PackageUpdateEligibilityService packageUpdateEligibility;
    private final PackageUpdateDispatchService packageUpdateDispatchService;
    private final PackageAutoUpdatePolicyService autoUpdatePolicyService;

    public void dispatch(SoftwareSchedule schedule, List<String> machineIds, Instant now) {
        if (schedule.getPackages() == null || schedule.getPackages().isEmpty()
                || machineIds == null || machineIds.isEmpty()) {
            log.info("Software schedule scheduleId={} has no packages or no target devices — nothing dispatched",
                    schedule.getId());
            return;
        }
        Map<String, OsType> osTypes = machinePlatformResolver.osTypesByMachineId(machineIds);
        Set<String> orderMachines = packageUpdateEligibility.eligibleMachines(schedule.getAction(), machineIds);
        for (SoftwareSchedulePackage pkg : schedule.getPackages()) {
            dispatchPackage(schedule, pkg, machineIds, osTypes, orderMachines);
        }
    }

    private void dispatchPackage(SoftwareSchedule schedule, SoftwareSchedulePackage pkg, List<String> machineIds,
                                 Map<String, OsType> osTypes, Set<String> orderMachines) {
        PackageManagerHandler handler = packageManagerRegistry.handlerFor(pkg.getPackageManager());
        SoftwareScriptCode code = handler.scriptCode(schedule.getAction());

        Optional<Script> found = scriptRepository.findByTenantIdAndNameAndType(
                schedule.getTenantId(), code.canonicalName(), ScriptType.SOFTWARE);
        if (found.isEmpty()) {
            log.warn("Software script {} not seeded for tenant {} — skipping package {} of schedule {}",
                    code.canonicalName(), schedule.getTenantId(), pkg.getPackageName(), schedule.getId());
            return;
        }
        Script script = found.get();

        List<String> targets = machinePlatformResolver.compatible(machineIds, osTypes, script.getSupportedPlatforms());
        if (targets.isEmpty()) {
            log.warn("Software schedule scheduleId={} package {}/{}: no OS-compatible device among {} target(s) (supports {}) — skipped",
                    schedule.getId(), pkg.getPackageManager(), pkg.getPackageName(), machineIds.size(),
                    script.getSupportedPlatforms());
            return;
        }

        String executionId = SoftwareExecutionId.forSchedule(schedule.getId(), pkg.getPackageManager(), pkg.getPackageName());
        List<String> orderTargets = targets.stream().filter(orderMachines::contains).toList();
        List<String> scriptTargets = targets.stream().filter(id -> !orderMachines.contains(id)).toList();
        RunningExecutionRows rows = RunningExecutionRows.builder()
                .tenantId(schedule.getTenantId())
                .executionId(executionId)
                .scriptId(script.getId())
                .privilegeLevel(script.getPrivilegeLevel())
                .timeoutSeconds(script.getDefaultTimeoutSeconds())
                .initiatedBy(schedule.getCreatedBy())
                .source(ExecutionSource.SCHEDULED)
                .packageManager(pkg.getPackageManager())
                .packageName(pkg.getPackageName())
                .softwareAction(schedule.getAction())
                .softwareScheduleId(schedule.getId())
                .build();

        if (!orderTargets.isEmpty()) {
            RunningExecutionRows orderRows = rows.toBuilder().machineIds(orderTargets).build();
            autoUpdatePolicyService.turnOn(orderRows, pkg.getBrewPackageType(), pkg.getSoftwareId(),
                    schedule.getAutoUpdate(), schedule.getUpdateSettings());
            packageUpdateDispatchService.dispatchAdminUpdate(orderRows, pkg.getBrewPackageType(),
                    schedule.getUpdateSettings());
        }
        if (scriptTargets.isEmpty()) {
            return;
        }

        List<String> args = handler.buildArgs(pkg.getPackageName(), pkg.getBrewPackageType());
        scriptExecutionRepository.saveQueued(rows.toBuilder().machineIds(scriptTargets).build());

        scriptTargets.forEach(machineId -> {
            ScriptMessage message = ScriptMessage.builder()
                    .executionId(executionId)
                    .scriptId(script.getId())
                    .machineId(machineId)
                    .code(script.getScriptBody())
                    .shell(script.getShell())
                    .privilegeLevel(script.getPrivilegeLevel())
                    .args(args)
                    .timeoutSeconds(script.getDefaultTimeoutSeconds())
                    .build();
            softwareNatsPublisher.publishSoftware(machineId, message);
            retryStore.store(executionId, machineId, DeliveryChannel.SOFTWARE, message);
        });

        log.info("Dispatched software schedule fire scheduleId={} executionId={} package={} manager={} action={} machines={}",
                schedule.getId(), executionId, pkg.getPackageName(), pkg.getPackageManager(), schedule.getAction(),
                scriptTargets.size());
    }
}
