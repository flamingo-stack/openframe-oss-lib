package com.openframe.client.service.rmm;

import com.openframe.data.document.rmm.script.ExecutionStatus;
import com.openframe.data.document.rmm.script.ScriptExecution;
import com.openframe.data.nats.rmm.model.ScriptExecutionAcknowledgeMessage;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class ScriptExecutionAcknowledgeService {

    private final ScriptExecutionRepository scriptExecutionRepository;

    public void acknowledge(ScriptExecutionAcknowledgeMessage ack) {
        if (isIncomplete(ack)) {
            log.warn("Execution ack missing ids: executionId={} machineId={} scriptIds={} — ignoring",
                    ack.getExecutionId(), ack.getMachineId(), ack.getScriptIds());
            return;
        }

        List<ScriptExecution> leaves = scriptExecutionRepository.findByMachineIdAndExecutionIdAndScriptIdIn(
                ack.getMachineId(), ack.getExecutionId(), ack.getScriptIds());
        if (leaves.isEmpty()) {
            log.warn("Execution ack: no leaf for executionId={} machineId={} scriptIds={}",
                    ack.getExecutionId(), ack.getMachineId(), ack.getScriptIds());
            return;
        }

        List<ScriptExecution> queued = leaves.stream()
                .filter(row -> row.getStatus() == ExecutionStatus.QUEUED)
                .toList();
        if (queued.isEmpty()) {
            log.debug("Execution ack: no QUEUED leaf to flip (already acked/resolved) executionId={} machineId={} scriptIds={}",
                    ack.getExecutionId(), ack.getMachineId(), ack.getScriptIds());
            return;
        }

        Instant now = Instant.now();
        queued.forEach(row -> flipToRunning(row, now));
        scriptExecutionRepository.saveAll(queued);
        log.info("Execution ack: QUEUED→RUNNING for {} leaf(s) executionId={} machineId={} scriptIds={}",
                queued.size(), ack.getExecutionId(), ack.getMachineId(), ack.getScriptIds());
    }

    private boolean isIncomplete(ScriptExecutionAcknowledgeMessage ack) {
        return ack.getExecutionId() == null || ack.getMachineId() == null
                || ack.getScriptIds() == null || ack.getScriptIds().isEmpty();
    }

    private void flipToRunning(ScriptExecution row, Instant now) {
        row.setStatus(ExecutionStatus.RUNNING);
        row.setStatusChangedAt(now);
    }
}
