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

    /** Supported platforms, serialized as their enum names. */
    private List<String> supportedPlatforms;

    /** Ids of the existing {@code Script}s this schedule runs; resolved to Script objects by the GraphQL layer. */
    private List<String> scriptIds;

    /** Id of the creating user; resolved to a User via the GraphQL {@code author} field. */
    private String createdBy;

    /** Lifecycle status enum name (e.g. {@code ACTIVE}). */
    private String status;

    private Instant statusChangedAt;
    private Instant createdAt;
    private Instant updatedAt;
}
