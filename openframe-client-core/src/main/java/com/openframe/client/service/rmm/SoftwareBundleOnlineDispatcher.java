package com.openframe.client.service.rmm;

import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.script.DeliveryChannel;
import com.openframe.data.document.rmm.script.ExecutionSource;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.rmm.script.RunningExecutionRows;
import com.openframe.data.document.rmm.script.Script;
import com.openframe.data.document.rmm.script.ScriptType;
import com.openframe.data.document.rmm.software.SoftwareBundle;
import com.openframe.data.document.rmm.software.SoftwareBundlePackage;
import com.openframe.data.document.rmm.software.SoftwareExecutionId;
import com.openframe.data.document.rmm.software.SoftwareScriptCode;
import com.openframe.data.nats.rmm.model.ScriptMessage;
import com.openframe.data.nats.rmm.publisher.SoftwareNatsPublisher;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import com.openframe.data.repository.rmm.ScriptRepository;
import com.openframe.data.service.rmm.software.PackageManagerHandler;
import com.openframe.data.service.rmm.software.PackageManagerRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

@Component
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
@Slf4j
public class SoftwareBundleOnlineDispatcher {

    private final ScriptRepository scriptRepository;
    private final PackageManagerRegistry packageManagerRegistry;
    private final ScriptExecutionRepository scriptExecutionRepository;
    private final SoftwareNatsPublisher softwareNatsPublisher;
    private final ScriptDeliveryRetryStore retryStore;

    public void dispatch(SoftwareBundle bundle, Machine machine) {
        if (bundle.getPackages() == null || bundle.getPackages().isEmpty()) {
            return;
        }
        for (SoftwareBundlePackage pkg : bundle.getPackages()) {
            dispatchPackage(bundle, pkg, machine);
        }
    }

    private void dispatchPackage(SoftwareBundle bundle, SoftwareBundlePackage pkg, Machine machine) {
        String machineId = machine.getMachineId();
        PackageManagerHandler handler = packageManagerRegistry.handlerFor(pkg.getPackageManager());
        SoftwareScriptCode code = handler.scriptCode(bundle.getAction());

        Optional<Script> found = scriptRepository.findByTenantIdAndNameAndType(
                bundle.getTenantId(), code.canonicalName(), ScriptType.SOFTWARE);
        if (found.isEmpty()) {
            log.warn("Software script {} not seeded for tenant {} — skipping package {} of bundle {}",
                    code.canonicalName(), bundle.getTenantId(), pkg.getPackageName(), bundle.getId());
            return;
        }
        Script script = found.get();

        OsType osType = machine.getOsType();
        if (osType == null || script.getSupportedPlatforms() == null
                || !script.getSupportedPlatforms().contains(osType)) {
            log.debug("Skipping package {}/{} for machine {} — OS {} not supported by {} ({})",
                    pkg.getPackageManager(), pkg.getPackageName(), machineId, osType,
                    code.canonicalName(), script.getSupportedPlatforms());
            return;
        }

        List<String> args = handler.buildArgs(pkg.getPackageName(), pkg.getBrewPackageType());
        String executionId = SoftwareExecutionId.forBundle(bundle.getId(), pkg.getPackageManager(), pkg.getPackageName());

        scriptExecutionRepository.saveQueued(RunningExecutionRows.builder()
                .tenantId(bundle.getTenantId())
                .executionId(executionId)
                .scriptId(script.getId())
                .machineIds(List.of(machineId))
                .privilegeLevel(script.getPrivilegeLevel())
                .timeoutSeconds(script.getDefaultTimeoutSeconds())
                .initiatedBy(bundle.getCreatedBy())
                .source(ExecutionSource.MANUAL)
                .packageManager(pkg.getPackageManager())
                .packageName(pkg.getPackageName())
                .softwareAction(bundle.getAction())
                .softwareBundleId(bundle.getId())
                .build());

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

        log.info("Dispatched software bundle fire bundleId={} executionId={} package={} manager={} action={} machine={}",
                bundle.getId(), executionId, pkg.getPackageName(), pkg.getPackageManager(), bundle.getAction(), machineId);
    }
}
