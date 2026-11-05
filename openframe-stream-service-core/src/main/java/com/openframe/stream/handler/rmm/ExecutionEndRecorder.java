package com.openframe.stream.handler.rmm;

import com.openframe.audit.AuditContext;
import com.openframe.audit.AuditRecorder;
import com.openframe.data.document.audit.AuditActor;
import com.openframe.data.document.audit.AuditEntry;
import com.openframe.data.document.audit.AuditOutcome;
import com.openframe.data.document.rmm.script.ExecutionStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.openframe.data.document.audit.AuditAction.EXECUTION_END;

@Component
@RequiredArgsConstructor
public class ExecutionEndRecorder {

    private final AuditRecorder auditRecorder;

    public void ended(ExecutionEnd end) {
        AuditOutcome outcome = end.status() == ExecutionStatus.SUCCESS ? AuditOutcome.SUCCESS : AuditOutcome.FAILURE;
        Map<String, Object> details = new HashMap<>();
        details.put("scriptId", end.scriptId());
        details.put("initiatedBy", end.initiatedBy());
        details.put("exitCode", end.exitCode());
        details.put("timedOut", end.timedOut());
        AuditEntry entry = AuditEntry.builder()
                .action(EXECUTION_END)
                .outcome(outcome)
                .reason(end.error())
                .targetId(end.executionId())
                .deviceId(end.machineId())
                .tenantId(end.tenantId())
                .parentEventId(end.parentEventId())
                .details(details)
                .build();
        AuditContext device = auditRecorder.context(AuditActor.fromAgent(end.machineId(), List.of(), end.tenantId()));
        auditRecorder.record(entry, device);
    }

    public record ExecutionEnd(String tenantId, String executionId, String scriptId, String machineId, String initiatedBy,
                               String parentEventId, ExecutionStatus status, Integer exitCode, Boolean timedOut,
                               String error) {
    }
}
