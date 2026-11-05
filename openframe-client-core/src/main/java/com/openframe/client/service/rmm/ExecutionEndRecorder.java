package com.openframe.client.service.rmm;

import com.openframe.audit.AuditRecorder;
import com.openframe.data.document.audit.AuditAction;
import com.openframe.data.document.audit.AuditEntry;
import com.openframe.data.document.audit.AuditOutcome;
import com.openframe.data.document.rmm.script.ScriptExecution;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

import static com.openframe.data.document.audit.AuditAction.EXECUTION_END;
import static com.openframe.data.document.audit.AuditAction.EXECUTION_EXPIRE;

@Component
@RequiredArgsConstructor
public class ExecutionEndRecorder {

    private final AuditRecorder auditRecorder;

    public void ended(ScriptExecution row, AuditOutcome outcome, String reason) {
        record(row, EXECUTION_END, outcome, reason);
    }

    public void expired(ScriptExecution row) {
        record(row, EXECUTION_EXPIRE, AuditOutcome.FAILURE, row.getError());
    }

    private void record(ScriptExecution row, AuditAction action, AuditOutcome outcome, String reason) {
        Map<String, Object> details = new HashMap<>();
        details.put("scriptId", row.getScriptId());
        details.put("initiatedBy", row.getInitiatedBy());
        details.put("exitCode", row.getExitCode());
        details.put("packageName", row.getPackageName());
        auditRecorder.record(AuditEntry.builder()
                .action(action)
                .outcome(outcome)
                .reason(reason)
                .targetId(row.getExecutionId())
                .deviceId(row.getMachineId())
                .tenantId(row.getTenantId())
                .parentEventId(row.getParentEventId())
                .details(details)
                .build());
    }
}
