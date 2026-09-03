package com.openframe.api.dto.packageinstall;

import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class UninstallPackageInput {

    @NotBlank
    @Pattern(
            regexp = "^[A-Za-z0-9_-]+$",
            message = "machineId must be a single subject-safe token (A-Za-z0-9_-)")
    private String machineId;

    @NotNull
    private PackageManagerType packageManager;

    @NotBlank
    private String packageId;

    private BrewPackageType packageType;
}
