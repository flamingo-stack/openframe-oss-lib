package com.openframe.api.dto.rmm.script;

import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.rmm.script.PrivilegeLevel;
import com.openframe.data.document.rmm.script.ScriptShell;
import com.openframe.data.document.rmm.script.ScriptStatus;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.List;

@Data
@Builder
public class ScriptResponse {

    private String id;
    private String name;
    private String description;

    private ScriptShell shell;
    private PrivilegeLevel privilegeLevel;

    private String scriptBody;

    private List<OsType> supportedPlatforms;

    private Integer defaultTimeoutSeconds;
    private List<String> defaultArgs;
    private List<ScriptEnvVarInput> envVars;

    private String createdBy;

    private ScriptStatus status;

    private Instant statusChangedAt;
    private Instant createdAt;
    private Instant updatedAt;
}
