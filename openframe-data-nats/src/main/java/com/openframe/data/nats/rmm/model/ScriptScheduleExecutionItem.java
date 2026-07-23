package com.openframe.data.nats.rmm.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.openframe.data.document.rmm.PrivilegeLevel;
import com.openframe.data.document.rmm.ScriptEnvVar;
import com.openframe.data.document.rmm.ScriptShell;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * One saved-script payload inside a {@link ScriptScheduleExecutionMessage}. Mirrors the
 * per-script fields the agent needs to execute (code / shell / privilegeLevel / defaults),
 * with no override slots — schedules always run scripts with their stored defaults.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ScriptScheduleExecutionItem {

    private String scriptId;

    private String code;

    private ScriptShell shell;

    private PrivilegeLevel privilegeLevel;

    private List<String> args;

    private Integer timeoutSeconds;

    private List<ScriptEnvVar> envVars;
}
