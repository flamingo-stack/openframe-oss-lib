package com.openframe.api.dto.script;

import com.openframe.data.document.rmm.ScriptPlatform;
import com.openframe.data.document.rmm.ScriptShell;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.util.List;

/**
 * Input payload for creating a new script. Tenant attribution is taken from
 * the authenticated principal at the resolver / controller layer — clients
 * do not (and must not) supply a tenant id here.
 */
@Data
public class CreateScriptInput {

    @NotBlank
    private String name;

    private String description;

    @NotNull
    private ScriptShell shell;

    @NotBlank
    private String scriptBody;

    private String tag;

    private List<ScriptPlatform> supportedPlatforms;

    @Positive
    @Max(value = 600, message = "defaultTimeoutSeconds must not exceed 600 (10 minutes)")
    private Integer defaultTimeoutSeconds;

    private List<String> defaultArgs;

    @Valid
    private List<ScriptEnvVarInput> envVars;
}
