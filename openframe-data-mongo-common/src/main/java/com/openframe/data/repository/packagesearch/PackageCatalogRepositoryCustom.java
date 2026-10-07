package com.openframe.data.repository.packagesearch;

import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;

import java.util.List;

public interface PackageCatalogRepositoryCustom {

    void upsertAll(List<PackageCatalogEntry> entries);

    // afterCursor is the cursor of the last hit of the previous page, null for the first page
    PackageCatalogPage searchByName(PackageManagerType manager, String nameQuery, PackageCatalogOrder order,
                                    String afterCursor, int limit);
}
