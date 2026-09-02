package com.openframe.packagesearch.api;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.packagesearch.BrewPackageType;
import com.openframe.packagesearch.api.dto.PackageDetails;
import com.openframe.packagesearch.PackageManagerType;
import com.openframe.packagesearch.api.dto.PackageSearchInput;
import com.openframe.packagesearch.api.dto.PackageSearchResult;
import com.openframe.packagesearch.api.PackageSearchService;
import lombok.RequiredArgsConstructor;

@DgsComponent
@RequiredArgsConstructor
public class PackageSearchDataFetcher {

    private final PackageSearchService packageSearchService;

    @DgsQuery
    public PackageSearchResult searchPackages(@InputArgument PackageSearchInput input) {
        return packageSearchService.search(input);
    }

    @DgsQuery
    public PackageDetails packageDetails(@InputArgument PackageManagerType packageManager,
                                         @InputArgument String packageId,
                                         @InputArgument BrewPackageType packageType) {
        return packageSearchService.findPackage(packageManager, packageId, packageType);
    }
}
