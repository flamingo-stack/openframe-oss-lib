package com.openframe.api.dto.rmm.software;

import com.openframe.data.document.rmm.software.PackageUpdateMode;
import jakarta.validation.constraints.Max;
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

    @NotNull
    @Positive(message = "countdownSeconds must be positive")
    @Max(value = 3_600, message = "countdownSeconds must not exceed 1 hour")
    private Integer countdownSeconds;
}
