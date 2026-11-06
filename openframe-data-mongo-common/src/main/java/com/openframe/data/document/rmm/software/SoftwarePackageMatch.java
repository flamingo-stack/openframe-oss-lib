package com.openframe.data.document.rmm.software;

import com.openframe.data.document.packagesearch.PackageManagerType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

// what the package matcher said about a software title when the read model was last projected
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SoftwarePackageMatch {

    private PackageMatchState state;
    private PackageManagerType manager;
    private String packageId;
}
