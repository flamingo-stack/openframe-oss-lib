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
 *   Stream:  COMMAND_EXECUTION
 *   Subject: machine.{machineId}.command-execution
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

    /** Ad-hoc shell command. */
    private String code;

    private String shell;

    /** Positional command-line arguments. {@code null} or empty = no extra args. */
    private List<String> args;

    private Integer timeout;

    private List<String> envVars;
}
