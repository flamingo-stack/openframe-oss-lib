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

    // TODO: value should be ciphertext when secret=true; plaintext until secret management lands
    private String value;

    // TODO: secret values are written to MongoDB in plaintext until encryption-at-rest lands
    private boolean secret;
}
