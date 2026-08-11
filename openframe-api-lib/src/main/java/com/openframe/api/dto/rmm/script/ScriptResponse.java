package com.openframe.api.dto.rmm.script;

import com.openframe.data.document.rmm.OsType;
import com.openframe.data.document.rmm.PrivilegeLevel;
import com.openframe.data.document.rmm.ScriptShell;
import com.openframe.data.document.rmm.ScriptStatus;
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
