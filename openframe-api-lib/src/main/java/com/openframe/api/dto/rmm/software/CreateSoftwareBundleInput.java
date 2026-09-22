package com.openframe.api.dto.rmm.software;

import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.document.rmm.software.SoftwareBundleMode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

import java.time.Instant;
import java.util.List;

@Data
public class CreateSoftwareBundleInput {

    @NotNull(message = "action must not be null")
    private SoftwareAction action;

    @NotNull(message = "mode must not be null")
    private SoftwareBundleMode mode;

    @NotEmpty(message = "machineIds must not be empty")
    private List<@Pattern(regexp = "^[A-Za-z0-9_-]+$",
            message = "each machineId must be a single subject-safe token (A-Za-z0-9_-)") String> machineIds;

    @Valid
    private List<SoftwarePackageInput> packages;

    private Instant startAt;
}
