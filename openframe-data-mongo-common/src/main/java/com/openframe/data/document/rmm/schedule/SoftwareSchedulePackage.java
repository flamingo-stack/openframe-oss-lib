package com.openframe.data.document.rmm.schedule;

import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SoftwareSchedulePackage {

    private PackageManagerType packageManager;
    private String packageName;
    /** Brew-only sub-type (CASK/FORMULA); null for managers that do not distinguish. */
    private BrewPackageType brewPackageType;
}
