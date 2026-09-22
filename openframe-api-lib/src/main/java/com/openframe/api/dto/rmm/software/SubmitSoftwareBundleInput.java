package com.openframe.api.dto.rmm.software;

import com.openframe.data.document.rmm.software.SoftwareAction;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class SubmitSoftwareBundleInput {

    @NotNull
    private String id;

    @NotNull
    private SoftwareAction action;

    @NotEmpty(message = "packages must not be empty")
    @Size(max = 50, message = "packages must not exceed 50")
    @Valid
    private List<SoftwarePackageInput> packages;

    @Valid
    private SoftwareBundleScheduleInput schedule;
}
