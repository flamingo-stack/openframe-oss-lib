package com.openframe.data.document.rmm.schedule;

import com.openframe.data.document.TenantScoped;
import com.openframe.data.document.rmm.script.ScriptStatus;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.rmm.script.Script;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "script_schedules")
@CompoundIndex(
        def = "{'tenantId': 1, 'name': 1}"
)
@CompoundIndex(
        name = "status_nextRunAt",
        def = "{'status': 1, 'nextRunAt': 1}"
)
public class ScheduleScript implements TenantScoped {

    @Id
    private String id;

    private String tenantId;

    private String name;

    private String description;

    private List<OsType> supportedPlatforms;
    private List<String> scriptIds;

    private List<ScheduledScriptCustomParams> scriptCustomParams;

    @Builder.Default
    private ScheduleDeviceSelectionMode selectionMode = ScheduleDeviceSelectionMode.SPECIFIC;

    private ScheduleDeviceCriteria deviceCriteria;

    @Builder.Default
    private ScheduleScriptTrigger trigger = ScheduleScriptTrigger.DATE_TIME;

    @Builder.Default
    private ScheduleTimeReference timeReference = ScheduleTimeReference.SERVER;

    @Builder.Default
    private ScheduleOfflineBehavior offlineBehavior = ScheduleOfflineBehavior.SKIP;

    private Long reconnectWindowSeconds;

    private Instant startAt;

    private Long repeat;

    private Instant nextRunAt;

    private Instant lastRunAt;

    private String createdBy;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    @Indexed
    @Builder.Default
    private ScriptStatus status = ScriptStatus.ACTIVE;

    private Instant statusChangedAt;
}
