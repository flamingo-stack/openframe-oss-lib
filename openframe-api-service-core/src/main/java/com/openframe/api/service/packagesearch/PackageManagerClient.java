package com.openframe.api.service.packagesearch;

import com.openframe.api.dto.packagesearch.PackageDetails;
import com.openframe.api.dto.packagesearch.PackageSearchResult;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerType;

public interface PackageManagerClient {

    PackageManagerType getPackageManagerType();

    // afterCursor is a hit's raw cursor from the previous page (null for the first page); its format is the client's own
    PackageSearchResult search(String query, String afterCursor, int limit);

    // packageType disambiguates brew packages that exist as both formula and cask; other managers ignore it
    PackageDetails findPackage(String packageId, BrewPackageType packageType);
}
