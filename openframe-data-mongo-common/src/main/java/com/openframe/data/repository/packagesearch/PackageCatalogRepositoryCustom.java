package com.openframe.data.repository.packagesearch;

import com.openframe.data.document.packagesearch.PackageCatalogEntry;

import java.util.List;

public interface PackageCatalogRepositoryCustom {

    void upsertAll(List<PackageCatalogEntry> entries);
}
