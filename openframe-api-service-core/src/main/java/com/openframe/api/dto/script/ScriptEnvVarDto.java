package com.openframe.api.dto.script;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Symmetric DTO for a script environment variable — used both for input
 * (create/update) and for output (response). The shape is intentionally
 * identical in both directions; once secret-management lands, the mapper
 * will mask {@link #value} on output when {@link #secret} is {@code true}.
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
     * Whether {@link #value} is sensitive. The service layer currently rejects
     * {@code true} until encryption at rest and secure delivery to agents are
     * implemented.
     */
    private boolean secret;
}
