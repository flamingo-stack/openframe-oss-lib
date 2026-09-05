package com.openframe.api.dto.packageinstall;

import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class InstallPackageInput {

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

    // interpolated into the install script, so the charset stays strict
    @Size(max = 64)
    @Pattern(
            regexp = "^[A-Za-z0-9][A-Za-z0-9.+_-]*$",
            message = "version must start with a letter or digit and contain only A-Za-z0-9.+_-")
    private String version;
}
