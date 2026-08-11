package com.openframe.api.dto.rmm.script;

import com.openframe.data.document.rmm.PrivilegeLevel;
import com.openframe.data.document.rmm.OsType;
import com.openframe.data.document.rmm.ScriptShell;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class UpdateScriptInput {

    @NotBlank
    private String id;

    @NotBlank
    private String name;

    private String description;

    @NotNull
    private ScriptShell shell;

    @NotNull
    private PrivilegeLevel privilegeLevel;

    @NotBlank
    private String scriptBody;

    private List<OsType> supportedPlatforms;

    private Integer defaultTimeoutSeconds;

    private List<String> defaultArgs;

    @Valid
    private List<ScriptEnvVarInput> envVars;

    /** Ids of existing {@code Tag} entities to assign (replaces the current set). */
    private List<String> tagIds;
}
