package com.openframe.api.dto.rmm.software;

import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class SoftwarePackageInput {

    @NotNull
    private PackageManagerType packageManager;

    @NotBlank
    private String packageName;

    private BrewPackageType packageType;
}
