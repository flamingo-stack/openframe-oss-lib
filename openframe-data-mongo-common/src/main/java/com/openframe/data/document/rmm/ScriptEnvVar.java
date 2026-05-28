package com.openframe.data.document.rmm;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Environment variable exported on the agent before script execution.
 *
 * <p>Embedded inside the {@link Script} document — not a standalone Mongo
 * collection. When {@link #secret} is {@code true} the {@link #value} is
 * expected to be stored encrypted and delivered to the agent over a secure
 * channel; that pipeline is not yet implemented, so the service layer
 * currently rejects {@code secret = true} on write.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScriptEnvVar {

    /**
     * Variable name as exported on the agent.
     */
    @NotBlank
    private String name;

    /**
     * Variable value. For {@link #secret} variables this will eventually be
     * ciphertext rather than plaintext.
     */
    private String value;

    /**
     * Whether the {@link #value} is sensitive (passwords, API keys, tokens).
     * Sensitive variables are subject to encryption at rest, masked display
     * in the UI, and redaction in audit logs.
     */
    private boolean secret;
}
