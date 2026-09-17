package com.openframe.data.document.rmm.software;

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
public class SoftwareBundlePackage {

    private PackageManagerType packageManager;
    private String packageName;
    private BrewPackageType brewPackageType;
}
