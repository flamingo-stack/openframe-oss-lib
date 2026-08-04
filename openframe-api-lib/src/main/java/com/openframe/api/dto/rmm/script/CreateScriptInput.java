package com.openframe.api.dto.rmm.script;

import com.openframe.data.document.rmm.PrivilegeLevel;
import com.openframe.data.document.rmm.ScriptPlatform;
import com.openframe.data.document.rmm.ScriptShell;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
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

    @NotNull
    private PrivilegeLevel privilegeLevel;

    @NotBlank
    private String scriptBody;

    private List<ScriptPlatform> supportedPlatforms;

    private Integer defaultTimeoutSeconds;

    private List<String> defaultArgs;

    @Valid
    private List<ScriptEnvVarInput> envVars;

    private List<String> tagIds;
}
