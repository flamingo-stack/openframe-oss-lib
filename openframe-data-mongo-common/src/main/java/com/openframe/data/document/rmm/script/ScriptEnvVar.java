package com.openframe.data.document.rmm.script;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScriptEnvVar {

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
