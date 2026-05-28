package com.openframe.api.dto.script;

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
public class ScriptEnvVarDto {

    @NotBlank
    private String name;

    private String value;

    /**
     * Whether {@link #value} is sensitive (passwords, API keys, tokens).
     *
     * <p>TODO: until the secret-management story (encryption at rest +
     * secure delivery to agents) lands, secret values are stored in plaintext.
     * UI / logs / audit are responsible for masking and redaction in the meantime.
     */
    private boolean secret;
}
