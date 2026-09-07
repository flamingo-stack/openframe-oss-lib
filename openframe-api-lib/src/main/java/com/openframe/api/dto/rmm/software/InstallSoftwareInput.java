package com.openframe.api.dto.rmm.software;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class InstallSoftwareInput {
    @NotNull
    private String softwareId;

    @NotEmpty
    private List<String> machineIds;
}
