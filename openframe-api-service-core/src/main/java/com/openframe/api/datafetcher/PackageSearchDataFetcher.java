package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.api.dto.packagesearch.PackageDetails;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.api.dto.packagesearch.PackageSearchInput;
import com.openframe.api.dto.packagesearch.PackageSearchResult;
import com.openframe.api.service.packagesearch.PackageSearchService;
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
