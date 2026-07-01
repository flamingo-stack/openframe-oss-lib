package com.openframe.api.dto.rmm.script;

import com.openframe.data.document.rmm.PrivilegeLevel;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.List;

/**
 * API representation of a script. The internal {@code tenantId} is omitted —
 * the caller's tenant context is already known from authentication and never
 * needs to round-trip through the wire.
 */
@Data
@Builder
public class ScriptResponse {

    private String id;
    private String name;
    private String description;

    /** Shell enum name (e.g. {@code POWERSHELL}). */
    private String shell;

    /** Privilege the script runs as (USER / ADMIN). */
    private PrivilegeLevel privilegeLevel;

    private String scriptBody;

    /** Supported platforms, serialized as their enum names. */
    private List<String> supportedPlatforms;

    private Integer defaultTimeoutSeconds;
    private List<String> defaultArgs;
    private List<ScriptEnvVarInput> envVars;

    /** Id of the creating user; resolved to a User via the GraphQL {@code author} field. */
    private String createdBy;

    /** Lifecycle status enum name (e.g. {@code ACTIVE}). */
    private String status;

    private Instant statusChangedAt;
    private Instant createdAt;
    private Instant updatedAt;
}
