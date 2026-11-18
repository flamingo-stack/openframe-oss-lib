package com.openframe.api.dto.rmm.software;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class TurnOnSoftwareAutoUpdateInput {

    @NotNull
    private String softwareId;

    @NotNull
    private String bundleId;

    @NotNull
    @Valid
    private PackageUpdateSettingsInput settings;
}
