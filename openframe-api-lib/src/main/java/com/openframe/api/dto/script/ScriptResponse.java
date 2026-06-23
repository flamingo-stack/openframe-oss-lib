package com.openframe.api.dto.script;

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

    private String privilegeLevel;

    private String scriptBody;
    private String tag;

    /** Supported platforms, serialized as their enum names. */
    private List<String> supportedPlatforms;

    private Integer defaultTimeoutSeconds;
    private List<String> defaultArgs;
    private List<ScriptEnvVarInput> envVars;

    /** Lifecycle status enum name (e.g. {@code ACTIVE}). */
    private String status;

    private Instant statusChangedAt;
    private Instant createdAt;
    private Instant updatedAt;
}
