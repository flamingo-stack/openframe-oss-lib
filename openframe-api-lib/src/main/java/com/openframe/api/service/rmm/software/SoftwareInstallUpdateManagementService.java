package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.script.ScriptResponse;
import com.openframe.api.dto.rmm.software.SoftwareDispatchResult;
import com.openframe.api.dto.rmm.software.SoftwareManagementInput;
import com.openframe.api.dto.rmm.software.SoftwarePackageInput;
import com.openframe.api.service.rmm.script.ScriptService;
import com.openframe.data.document.rmm.script.ExecutionSource;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.rmm.script.RunningExecutionRows;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.document.rmm.software.SoftwareScriptCode;
import com.openframe.data.nats.packageupdate.PackageUpdateDispatchService;
import com.openframe.data.service.rmm.MachinePlatformResolver;
import com.openframe.data.service.rmm.software.PackageManagerHandler;
import com.openframe.data.service.rmm.software.PackageManagerRegistry;
import com.openframe.data.service.rmm.software.PackageUpdateEligibilityService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

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

    public List<SoftwareDispatchResult> install(SoftwareManagementInput input, String initiatedBy, ExecutionSource source) {
        return dispatch(SoftwareAction.INSTALL, input, initiatedBy, source);
    }

    public List<SoftwareDispatchResult> update(SoftwareManagementInput input, String initiatedBy, ExecutionSource source) {
        return dispatch(SoftwareAction.UPDATE, input, initiatedBy, source);
    }

    private List<SoftwareDispatchResult> dispatch(SoftwareAction action, SoftwareManagementInput input,
                                                  String initiatedBy, ExecutionSource source) {
        List<String> machineIds = input.getMachineIds();
        Map<String, OsType> osTypes = machinePlatformResolver.osTypesByMachineId(machineIds);
        Set<String> orderMachines = packageUpdateEligibility.eligibleMachines(action, machineIds);
        Map<SoftwareScriptCode, ScriptResponse> scriptCache = new EnumMap<>(SoftwareScriptCode.class);

        List<SoftwareDispatchResult> results = new ArrayList<>(input.getPackages().size());
        for (SoftwarePackageInput pkg : input.getPackages()) {
            PackageManagerHandler handler = packageManagerRegistry.handlerFor(pkg.getPackageManager());
            SoftwareScriptCode code = handler.scriptCode(action);
            ScriptResponse script = scriptCache.computeIfAbsent(code, scriptService::getSoftwareScript);

            List<String> targets = machinePlatformResolver.compatible(machineIds, osTypes, script.getSupportedPlatforms());
            if (targets.isEmpty()) {
                log.warn("Software {} skipped package {}/{}: no OS-compatible device among {} target(s) (supports {})",
                        action, pkg.getPackageManager(), pkg.getPackageName(), machineIds.size(),
                        script.getSupportedPlatforms());
                continue;
            }

            List<String> args = handler.buildArgs(pkg.getPackageName(), pkg.getBrewPackageType());

            List<String> orderTargets = targets.stream().filter(orderMachines::contains).toList();
            List<String> scriptTargets = targets.stream().filter(id -> !orderMachines.contains(id)).toList();
            String executionId = UUID.randomUUID().toString();

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

            results.add(SoftwareDispatchResult.builder()
                    .packageManager(pkg.getPackageManager())
                    .packageName(pkg.getPackageName())
                    .executionId(executionId)
                    .build());
        }

        log.info("Software {} dispatched: packages={}/{} machines={} initiatedBy={} source={}",
                action, results.size(), input.getPackages().size(), machineIds.size(), initiatedBy, source);
        return results;
    }
}
