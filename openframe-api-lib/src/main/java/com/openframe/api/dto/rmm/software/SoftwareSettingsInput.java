package com.openframe.api.dto.rmm.software;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class SoftwareSettingsInput {

    @NotNull
    private Boolean updateExistingChocolateyPackages;
}
