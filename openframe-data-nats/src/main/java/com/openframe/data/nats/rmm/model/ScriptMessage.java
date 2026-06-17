package com.openframe.data.nats.rmm.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.openframe.data.document.rmm.PrivilegeLevel;
import com.openframe.data.document.rmm.ScriptShell;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Wire payload sent to the OpenFrame agent over core NATS for a single
 * saved-script execution.
 *
 * <pre>
 *   Subject: machine.{machineId}.script-execution
 * </pre>
 *
 * <p>Mirrors {@link CommandMessage} but carries a stored script's body plus its
 * run arguments and environment variables (resolved server-side from the saved
 * {@code Script}).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ScriptMessage {

    private String executionId;

    private String scriptBody;

    private ScriptShell shell;

    private List<String> args;

    private Map<String, String> envVars;

    private PrivilegeLevel privilegeLevel;

    private Integer timeout;
}
