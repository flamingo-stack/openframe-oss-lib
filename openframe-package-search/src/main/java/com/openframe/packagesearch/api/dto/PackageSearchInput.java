package com.openframe.packagesearch.api.dto;

import com.openframe.packagesearch.BrewPackageType;
import com.openframe.packagesearch.PackageManagerType;
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
