package com.openframe.api.dto.command;

import com.openframe.data.document.rmm.PrivilegeLevel;
import com.openframe.data.document.rmm.ScriptShell;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

/**
 * GraphQL input for dispatching one ad-hoc shell command to several agents at
 * once ({@code batchRunCommand}). A single {@code executionId} is minted server-side and
 * sent to all of them.
 */
@Data
public class BatchRunCommandInput {

    /**
     * Upper bound on machines per batch. Caps the fan-out so a single request
     * can't drive an unbounded {@code saveAll} + one NATS publish per machine.
     */
    public static final int MAX_BATCH_SIZE = 100;

    /**
     * Target machines. Each id must be a single subject-safe token because it
     * is interpolated into the NATS subject {@code machine.<id>.command-execution}.
     */
    @NotEmpty(message = "machineIds must not be empty")
    @Size(max = MAX_BATCH_SIZE, message = "machineIds must not exceed " + MAX_BATCH_SIZE + " machines per batch")
    private List<@NotBlank @Pattern(
            regexp = "^[A-Za-z0-9_-]+$",
            message = "each machineId must be a single subject-safe token (A-Za-z0-9_-)") String> machineIds;

    @NotBlank
    private String command;

    @NotNull
    private ScriptShell shell;

    @NotNull
    private PrivilegeLevel privilegeLevel;

    @Positive
    @Max(value = 600, message = "timeoutSeconds must not exceed 600 (10 minutes)")
    private Integer timeoutSeconds;
}
