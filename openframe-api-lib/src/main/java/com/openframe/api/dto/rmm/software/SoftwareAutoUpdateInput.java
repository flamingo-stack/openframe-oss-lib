package com.openframe.api.dto.rmm.software;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class SoftwareAutoUpdateInput {

    @NotNull
    private Boolean enabled;

    @Valid
    private PackageUpdateSettingsInput settings;
}
