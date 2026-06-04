package com.openframe.data.nats.rmm.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.openframe.data.document.rmm.PrivilegeLevel;
import com.openframe.data.document.rmm.ScriptShell;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Wire payload sent to the OpenFrame agent over core NATS for a single
 * ad-hoc-command execution.
 *
 * <pre>
 *   Subject: machine.{machineId}.command-execution
 * </pre>
 *
 * <p>Example payload the agent expects:
 *
 * <pre>{@code
 * {
 *   "executionId": "01HXYZ...",
 *   "code": "echo hello",
 *   "shell": "BASH",
 *   "privilegeLevel": "ADMIN",
 *   "timeout": 30
 * }
 * }</pre>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CommandMessage {

    private String executionId;

    private String code;

    private ScriptShell shell;

    private PrivilegeLevel privilegeLevel;

    private Integer timeout;
}
