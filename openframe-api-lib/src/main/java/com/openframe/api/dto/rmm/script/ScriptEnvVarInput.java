package com.openframe.api.dto.rmm.script;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Symmetric DTO for a script environment variable — used both for input
 * (create/update) and for output (response). The shape is intentionally
 * identical in both directions.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScriptEnvVarInput {

    @NotBlank
    private String name;

    private String value;

    // TODO: secret values are stored in plaintext until secret management lands; UI/logs/audit must mask.
    private boolean secret;
}

