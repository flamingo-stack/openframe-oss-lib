package com.openframe.api.dto.rmm.schedule;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.List;

/**
 * API representation of a script schedule. The internal {@code tenantId} is
 * omitted — the caller's tenant context is already known from authentication.
 */
@Data
@Builder
public class ScriptScheduleResponse {

    private String id;
    private String name;
    private String description;

    private List<String> supportedPlatforms;

    private List<String> scriptIds;

    private String trigger;

    private Instant startAt;
    private Long repeat;
    private Instant nextRunAt;
    private Instant lastRunAt;

    private String createdBy;

    private String status;

    private Instant statusChangedAt;
    private Instant createdAt;
    private Instant updatedAt;
}
