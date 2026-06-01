package com.openframe.api.dto.command;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.util.List;

/**
 * GraphQL input for dispatching an ad-hoc shell command to an agent.
 *
 * <p>This is a transit-only payload — nothing is persisted on the backend.
 * The command flies through to the agent over NATS and the agent's response
 * is delivered back via a separate result subject (handled by the
 * execution-service, out of scope here).
 */
@Data
public class RunCommandInput {

    /** Target agent's {@code machineId} (matches Mongo {@code Machine.machineId}). */
    @NotBlank
    private String machineId;

    /**
     * Absolute path to the shell interpreter on the agent host
     * (e.g. {@code "/bin/bash"}, {@code "/usr/bin/python3"},
     * {@code "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe"}).
     */
    @NotBlank
    private String shell;

    /**
     * The raw command line / script body. Typed by the admin in the dashboard
     * — sent through unchanged.
     */
    @NotBlank
    private String command;

    /** Optional positional arguments to pass to the shell after {@link #command}. */
    private List<String> args;

    /**
     * Optional environment variables in Unix {@code KEY=value} form. The list
     * is sent as-is to the agent; no parsing or validation on the backend.
     */
    private List<String> envVars;

    /** Optional execution timeout in seconds. {@code null} delegates to the agent's default. */
    @Positive
    private Integer timeoutSeconds;
}
