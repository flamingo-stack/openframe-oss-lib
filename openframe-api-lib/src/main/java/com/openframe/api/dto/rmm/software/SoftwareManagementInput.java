package com.openframe.api.dto.rmm.software;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class SoftwareManagementInput {

    // Bounds the synchronous fan-out (each package fans one message per machine); mirrors
    // BatchRunScriptInput.MAX_BATCH_SIZE so software and script batches share the same cap.
    public static final int MAX_MACHINES = 100;

    @NotEmpty(message = "machineIds must not be empty")
    @Size(max = MAX_MACHINES, message = "machineIds must not exceed " + MAX_MACHINES + " machines")
    private List<@NotBlank @Pattern(
            regexp = "^[A-Za-z0-9_-]+$",
            message = "each machineId must be a single subject-safe token (A-Za-z0-9_-)") String> machineIds;

    @NotEmpty(message = "packages must not be empty")
    @Valid
    private List<SoftwarePackageInput> packages;
}
