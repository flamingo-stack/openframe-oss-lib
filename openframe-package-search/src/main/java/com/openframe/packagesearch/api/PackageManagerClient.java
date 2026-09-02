package com.openframe.packagesearch.api;

import com.openframe.packagesearch.BrewPackageType;
import com.openframe.packagesearch.api.dto.PackageDetails;
import com.openframe.packagesearch.PackageManagerType;
import com.openframe.packagesearch.api.dto.PackageSearchResult;

public interface PackageManagerClient {

    PackageManagerType getPackageManagerType();

    PackageSearchResult search(String query, int limit, int offset);

    // packageType disambiguates brew packages that exist as both formula and cask; other managers ignore it
    PackageDetails findPackage(String packageId, BrewPackageType packageType);
}
