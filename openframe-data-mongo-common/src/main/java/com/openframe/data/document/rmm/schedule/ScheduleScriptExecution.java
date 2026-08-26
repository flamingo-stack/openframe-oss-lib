package com.openframe.data.document.rmm.schedule;

import com.openframe.data.document.TenantScoped;
import com.openframe.data.document.rmm.script.ExecutionStatus;
import com.openframe.data.document.rmm.script.ScriptExecution;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "schedule_script_execution")
@CompoundIndex(
        name = "tenant_executionId_unique",
        def = "{'tenantId': 1, 'executionId': 1}",
        unique = true
)
@CompoundIndex(
        name = "tenant_schedule_dispatchedAt",
        def = "{'tenantId': 1, 'scheduleId': 1, 'dispatchedAt': -1}"
)
@CompoundIndex(name = "status_dispatchedAt", def = "{'status': 1, 'dispatchedAt': 1}")
public class ScheduleScriptExecution implements TenantScoped {

    @Id
    private String id;

    private String tenantId;

    /** Correlation id shared with every leaf {@link ScriptExecution} row this fire produced. */
    @Indexed
    private String executionId;

    @Indexed
    private String scheduleId;

    private String initiatedBy;

    @Indexed
    private ExecutionStatus status;

    private int totalMachineCount;

    private Instant dispatchedAt;
    private Instant finishedAt;

    @CreatedDate
    private Instant createdAt;
}
