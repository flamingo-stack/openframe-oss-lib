package com.openframe.client.service.rmm;

import com.openframe.data.document.rmm.script.ExecutionStatus;
import com.openframe.data.nats.rmm.model.ScriptExecutionAcknowledgeMessage;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;

/**
 * Handles an agent's delivery acknowledgement: flips the leaf {@code ScriptExecution} from
 * {@code QUEUED} to {@code RUNNING} and evicts the delivery-retry state, since the ack proves the
 * whole (executionId, machineId) batch reached the agent.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ScriptExecutionAcknowledgeService {

    private final ScriptExecutionRepository scriptExecutionRepository;

    public void acknowledge(ScriptExecutionAcknowledgeMessage ack) {
        if (ack.getExecutionId() == null || ack.getMachineId() == null || ack.getScriptId() == null) {
            log.warn("Execution ack missing ids: executionId={} machineId={} scriptId={} — ignoring",
                    ack.getExecutionId(), ack.getMachineId(), ack.getScriptId());
            return;
        }
        scriptExecutionRepository
                .findByMachineIdAndExecutionIdAndScriptId(ack.getMachineId(), ack.getExecutionId(), ack.getScriptId())
                .ifPresentOrElse(row -> {
                    if (row.getStatus() == ExecutionStatus.QUEUED) {
                        row.setStatus(ExecutionStatus.RUNNING);
                        row.setStatusChangedAt(Instant.now());
                        scriptExecutionRepository.save(row);
                        log.info("Execution ack: QUEUED→RUNNING executionId={} scriptId={} machineId={}",
                                ack.getExecutionId(), ack.getScriptId(), ack.getMachineId());
                    } else {
                        log.debug("Execution ack: leaf not QUEUED (status={}) — no flip executionId={} scriptId={} machineId={}",
                                row.getStatus(), ack.getExecutionId(), ack.getScriptId(), ack.getMachineId());
                    }
                }, () -> log.warn("Execution ack: no leaf for executionId={} machineId={} scriptId={}",
                        ack.getExecutionId(), ack.getMachineId(), ack.getScriptId()));
    }
}
