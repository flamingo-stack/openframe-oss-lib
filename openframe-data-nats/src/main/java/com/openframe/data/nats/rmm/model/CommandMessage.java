package com.openframe.data.nats.rmm.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Wire payload sent to the OpenFrame agent over NATS JetStream for a single
 * script / ad-hoc-command execution.
 *
 *
 * <pre>
 *   Stream:  SCRIPT_EXECUTION
 *   Subject: machine.{machineId}.script-execution
 * </pre>
 *
 * <p>Example payload the agent expects:
 *
 * <pre>{@code
 * {
 *   "executionId": "01HXYZ...",
 *   "code": "#!/bin/bash\necho hello",
 *   "shell": "/bin/bash",
 *   "args": [],
 *   "timeout": 30,
 *   "envVars": ["MY_VAR=test_value"]
 * }
 * }</pre>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CommandMessage {

    /** Server-generated correlation id. Comes back unchanged in the agent's response. */
    private String executionId;

    /**
     * Script body or ad-hoc shell command. For commands typed in the dashboard
     * this is just the raw command line (e.g. {@code "df -h"}); for saved
     * scripts it's the script body, optionally with a shebang line.
     */
    private String code;

    /**
     * Absolute path to the shell interpreter on the agent host
     * ({@code "/bin/bash"}, {@code "/usr/bin/python3"}, etc.). The mapping
     * from a user-facing shell choice (BASH / POWERSHELL / …) to a concrete
     * path is the caller's responsibility.
     */
    private String shell;

    /** Positional command-line arguments. {@code null} or empty = no extra args. */
    private List<String> args;

    /**
     * Execution timeout in seconds. {@code null} delegates to the agent's
     * default. The agent will kill the process and set {@code timedOut=true}
     * in its response when this is exceeded.
     */
    private Integer timeout;

    /**
     * Environment variables in Unix {@code KEY=value} form (e.g.
     * {@code "LOG_LEVEL=INFO"}). {@code null} or empty = no extra env.
     */
    private List<String> envVars;
}
