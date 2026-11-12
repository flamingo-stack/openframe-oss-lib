package com.openframe.api.dto.rmm.software;

import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerType;

public interface SoftwarePackageSelection {

    PackageManagerType getPackageManager();

    void setPackageManager(PackageManagerType packageManager);

    String getPackageName();

    void setPackageName(String packageName);

    void setBrewPackageType(BrewPackageType brewPackageType);

    String getSoftwareId();
}
