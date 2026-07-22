package com.openframe.data.document.rmm;

import com.openframe.data.document.TenantScoped;
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

/**
 * Script schedule — a named task that runs a set of existing {@link Script}s
 * (ad-hoc or, eventually, on a recurring schedule) against assigned machines.

 */
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
public class ScriptSchedule implements TenantScoped {

    @Id
    private String id;

    private String tenantId;

    private String name;

    private String description;

    private List<ScriptPlatform> supportedPlatforms;
    private List<String> scriptIds;

    @Builder.Default
    private ScriptScheduleTrigger trigger = ScriptScheduleTrigger.DATE_TIME;

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
