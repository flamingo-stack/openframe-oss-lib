package com.openframe.data.document.rmm;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Environment variable exported on the agent before script execution.
 *
 * <p>Embedded inside the {@link Script} document — not a standalone Mongo
 * collection. When {@link #secret} is {@code true} the {@link #value} is
 * eventually expected to be stored encrypted and delivered to the agent over a
 * secure channel. That pipeline is not yet implemented: {@code secret = true}
 * is accepted and the value is currently stored in plaintext (no rejection,
 * no encryption) — see the follow-up secret-management story.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScriptEnvVar {

    /**
     * Variable name as exported on the agent.
     */
    private String name;

    /**
     * <p>TODO: when {@link #secret} is {@code true} this will eventually be
     * ciphertext. Until the secret-management story lands, secret values are
     * stored in plaintext.
     */
    private String value;

    /**
     * <p>TODO: until the secret-management story (encryption at rest +
     * secure delivery to agents) lands, secret values are written to MongoDB
     * in plaintext.
     */
    private boolean secret;
}
