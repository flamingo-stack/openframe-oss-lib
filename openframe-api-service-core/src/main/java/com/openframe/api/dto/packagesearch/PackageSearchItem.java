package com.openframe.api.dto.packagesearch;

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
public class PackageSearchItem {

    private String id;
    private String name;
    private String description;
    private String version;
    private String publisher;
    private String homepage;
    private String iconUrl;
    private String installCommand;
    private BrewPackageType packageType;
    private Integer popularity;
    private PackageManagerType packageManager;
}
