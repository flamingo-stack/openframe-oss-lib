package com.openframe.api.dto.rmm.software;

import com.openframe.data.document.packagesearch.PackageManagerType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class AdoptSoftwareInput {

    private PackageManagerType packageManager;

    private String packageName;

    @NotEmpty(message = "machineIds must not be empty")
    @Size(max = SoftwareManagementInput.MAX_MACHINES,
            message = "machineIds must not exceed " + SoftwareManagementInput.MAX_MACHINES + " machines")
    private List<@NotBlank String> machineIds;
}
