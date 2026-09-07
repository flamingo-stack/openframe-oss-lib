package com.openframe.client.service.rmm;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.script.ExecutionSource;
import com.openframe.data.document.rmm.script.ExecutionStatus;
import com.openframe.data.document.rmm.script.Script;
import com.openframe.data.document.rmm.script.ScriptExecution;
import com.openframe.data.nats.rmm.model.ScriptMessage;
import com.openframe.data.nats.rmm.publisher.ScriptNatsPublisher;
import com.openframe.data.nats.rmm.util.ScriptArgsTokenizer;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import com.openframe.data.repository.rmm.ScriptRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/**
 * Dispatches the seeded bootstrap SYSTEM script when an agent reports a missing
 * package manager. Mirrors the api-lib single-run dispatch (persist a RUNNING
 * row, publish the ScriptMessage) — api-lib itself is not on this classpath.
 *
 * <p>Retry is owned by the agent: it re-reports on its next check cycle, so the
 * server only suppresses repeats — an in-flight run, or anything dispatched
 * within the cooldown window. The scripts themselves are idempotent (exit 0
 * when the manager is already installed), so a lost race double-dispatch is
 * harmless.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PackageManagerBootstrapService {

    private static final String INITIATED_BY = "system";

    private final MachineRepository machineRepository;
    private final ScriptRepository scriptRepository;
    private final ScriptExecutionRepository scriptExecutionRepository;
    private final ScriptNatsPublisher scriptNatsPublisher;

    @Value("${openframe.rmm.package-manager-bootstrap.cooldown-seconds:1800}")
    private long cooldownSeconds;

    public void installIfAbsent(String machineId, PackageManagerType packageManager) {
        Optional<Machine> foundMachine = machineRepository.findByMachineId(machineId);
        if (foundMachine.isEmpty()) {
            log.warn("Package-manager report for unknown machine {}, ignoring", machineId);
            return;
        }
        Machine machine = foundMachine.get();
        DeviceStatus status = machine.getStatus();
        if (!DeviceStatus.DISPATCH_ELIGIBLE.contains(status)) {
            log.debug("Ignoring package-manager report for machineId={} in status {}", machineId, status);
            return;
        }

        String tenantId = machine.getTenantId();
        Optional<Script> foundScript = scriptRepository.findSystemScript(packageManager.bootstrapScript(), tenantId);
        if (foundScript.isEmpty()) {
            log.warn("Bootstrap script {} not seeded for tenant {}, ignoring report from machineId={}",
                    packageManager.bootstrapScript(), tenantId, machineId);
            return;
        }
        Script script = foundScript.get();

        if (isSuppressed(tenantId, machineId, script.getId())) {
            return;
        }

        dispatch(tenantId, machineId, packageManager, script);
    }

    private boolean isSuppressed(String tenantId, String machineId, String scriptId) {
        Optional<ScriptExecution> last = scriptExecutionRepository
                .findFirstByTenantIdAndMachineIdAndScriptIdAndSourceOrderByDispatchedAtDesc(
                        tenantId, machineId, scriptId, ExecutionSource.SYSTEM_BOOTSTRAP);
        if (last.isEmpty()) {
            return false;
        }
        ScriptExecution execution = last.get();
        if (execution.getStatus() == ExecutionStatus.QUEUED || execution.getStatus() == ExecutionStatus.RUNNING) {
            log.debug("Bootstrap already in flight for machineId={} scriptId={} executionId={} — skipping",
                    machineId, scriptId, execution.getExecutionId());
            return true;
        }
        Instant dispatchedAt = execution.getDispatchedAt();
        if (dispatchedAt != null && dispatchedAt.isAfter(Instant.now().minusSeconds(cooldownSeconds))) {
            log.debug("Bootstrap for machineId={} scriptId={} dispatched at {} is within the cooldown — skipping",
                    machineId, scriptId, dispatchedAt);
            return true;
        }
        return false;
    }

    private void dispatch(String tenantId, String machineId, PackageManagerType packageManager, Script script) {
        String executionId = UUID.randomUUID().toString();
        Instant now = Instant.now();

        scriptExecutionRepository.save(ScriptExecution.builder()
                .tenantId(tenantId)
                .executionId(executionId)
                .scriptId(script.getId())
                .machineId(machineId)
                .privilegeLevel(script.getPrivilegeLevel())
                .timeoutSeconds(script.getDefaultTimeoutSeconds())
                .initiatedBy(INITIATED_BY)
                .source(ExecutionSource.SYSTEM_BOOTSTRAP)
                .status(ExecutionStatus.RUNNING)
                .dispatchedAt(now)
                .statusChangedAt(now)
                .build());

        scriptNatsPublisher.publishScript(machineId, ScriptMessage.builder()
                .executionId(executionId)
                .scriptId(script.getId())
                .machineId(machineId)
                .code(script.getScriptBody())
                .shell(script.getShell())
                .privilegeLevel(script.getPrivilegeLevel())
                .args(ScriptArgsTokenizer.tokenize(script.getDefaultArgs()))
                .timeoutSeconds(script.getDefaultTimeoutSeconds())
                .envVars(script.getEnvVars())
                .build());

        log.info("Dispatched {} bootstrap: machineId={} executionId={} scriptId={}",
                packageManager, machineId, executionId, script.getId());
    }
}
