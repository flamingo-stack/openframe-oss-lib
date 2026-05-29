package com.openframe.api.dto.script;

import com.openframe.data.document.rmm.ScriptPlatform;
import com.openframe.data.document.rmm.ScriptShell;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.util.List;

/**
 * Input payload for updating an existing script. All fields are optional;
 * only fields whose value is non-null are applied to the existing document
 * (PATCH semantics). To clear a multi-valued field, supply an explicit empty
 * list rather than {@code null}.
 */
@Data
public class UpdateScriptInput {

    private String name;

    private String description;

    private ScriptShell shell;

    private String scriptBody;

    private String tag;

    private List<ScriptPlatform> supportedPlatforms;

    @Positive
    private Integer defaultTimeoutSeconds;

    private List<String> defaultArgs;

    @Valid
    private List<ScriptEnvVarInput> envVars;
}
