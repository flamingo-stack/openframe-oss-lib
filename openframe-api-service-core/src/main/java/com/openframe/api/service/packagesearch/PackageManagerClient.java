package com.openframe.api.service.packagesearch;

import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.api.dto.packagesearch.PackageDetails;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.api.dto.packagesearch.PackageSearchResult;

public interface PackageManagerClient {

    PackageManagerType getPackageManagerType();

    PackageSearchResult search(String query, int limit, int offset);

    // packageType disambiguates brew packages that exist as both formula and cask; other managers ignore it
    PackageDetails findPackage(String packageId, BrewPackageType packageType);
}
