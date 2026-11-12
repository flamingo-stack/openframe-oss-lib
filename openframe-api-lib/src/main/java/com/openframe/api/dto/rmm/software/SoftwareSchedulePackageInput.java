package com.openframe.api.dto.rmm.software;

import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerType;
import lombok.Data;

@Data
public class SoftwareSchedulePackageInput implements SoftwarePackageSelection {

    private PackageManagerType packageManager;
    private String packageName;
    private BrewPackageType brewPackageType;
    private String softwareId;
}
