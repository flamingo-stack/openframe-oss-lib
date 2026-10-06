package com.openframe.data.repository.packagesearch;

import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import org.springframework.data.domain.Sort;

import java.util.List;

public interface PackageCatalogRepositoryCustom {

    void upsertAll(List<PackageCatalogEntry> entries);

    PackageCatalogPage searchByName(PackageManagerType manager, String nameQuery, Sort tieBreak, int offset, int limit);
}
