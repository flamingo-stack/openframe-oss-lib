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
 * Wire payload sent to the OpenFrame agent over core NATS for a single
 * saved-script execution.
 *
 * <pre>
 *   Subject: machine.{machineId}.script-execution
 * </pre>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ScriptMessage {

    private String machineId;

    private String code;

    private ScriptShell shell;

    private PrivilegeLevel privilegeLevel;

    private List<String> args;

    private Integer timeoutSeconds;

    private List<ScriptEnvVar> envVars;
}
