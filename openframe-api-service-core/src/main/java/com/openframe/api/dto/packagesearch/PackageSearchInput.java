package com.openframe.api.dto.packagesearch;

import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerType;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PackageSearchInput {

    private PackageManagerType packageManager;
    private String query;
    private Integer limit;
    private Integer offset;
}
