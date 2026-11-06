package com.openframe.api.dto.rmm.software;

import com.openframe.data.document.rmm.software.PackageUpdateMode;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

@Data
public class PackageUpdateSettingsInput {

    @NotNull
    private PackageUpdateMode mode;

    @Positive(message = "deadlineSeconds must be positive")
    @Max(value = 2_592_000, message = "deadlineSeconds must not exceed 30 days")
    private Long deadlineSeconds;

    // the agent clamps the countdown to 1-30 minutes (package_update.rs), and the form offers the same range
    @NotNull
    @Min(value = 60, message = "countdownSeconds must be at least 1 minute")
    @Max(value = 1_800, message = "countdownSeconds must not exceed 30 minutes")
    private Integer countdownSeconds;
}
