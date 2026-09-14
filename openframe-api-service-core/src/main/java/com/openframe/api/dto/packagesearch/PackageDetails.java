package com.openframe.api.dto.packagesearch;

import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PackageDetails {

    private String id;
    private PackageManagerType packageManager;
    private String name;
    private String description;
    private String publisher;
    private String homepage;
    private String iconUrl;
    private String license;
    private String installCommand;
    private BrewPackageType packageType;
    private Integer popularity;
    private List<String> tags;
    private List<PackageVersion> versions;
}
