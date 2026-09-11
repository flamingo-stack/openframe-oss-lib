package com.openframe.client.service.rmm;

import com.openframe.data.document.rmm.schedule.SoftwareSchedule;
import com.openframe.data.document.rmm.schedule.SoftwareSchedulePackage;
import com.openframe.data.document.rmm.script.DeliveryChannel;
import com.openframe.data.document.rmm.script.ExecutionSource;
import com.openframe.data.document.rmm.script.RunningExecutionRows;
import com.openframe.data.document.rmm.script.Script;
import com.openframe.data.document.rmm.script.ScriptType;
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

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

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

    public void dispatch(SoftwareSchedule schedule, List<String> machineIds, Instant now) {
        if (schedule.getPackages() == null || schedule.getPackages().isEmpty()
                || machineIds == null || machineIds.isEmpty()) {
            log.info("Software schedule scheduleId={} has no packages or no target devices — nothing dispatched",
                    schedule.getId());
            return;
        }
        for (SoftwareSchedulePackage pkg : schedule.getPackages()) {
            dispatchPackage(schedule, pkg, machineIds);
        }
    }

    private void dispatchPackage(SoftwareSchedule schedule, SoftwareSchedulePackage pkg, List<String> machineIds) {
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
        List<String> args = handler.buildArgs(pkg.getPackageName(), pkg.getBrewPackageType());
        String executionId = UUID.randomUUID().toString();

        scriptExecutionRepository.saveQueued(RunningExecutionRows.builder()
                .tenantId(schedule.getTenantId())
                .executionId(executionId)
                .scriptId(script.getId())
                .machineIds(machineIds)
                .privilegeLevel(script.getPrivilegeLevel())
                .timeoutSeconds(script.getDefaultTimeoutSeconds())
                .initiatedBy(schedule.getCreatedBy())
                .source(ExecutionSource.SCHEDULED)
                .packageManager(pkg.getPackageManager())
                .packageName(pkg.getPackageName())
                .softwareAction(schedule.getAction())
                .build());

        machineIds.forEach(machineId -> {
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
                machineIds.size());
    }
}
