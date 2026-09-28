package com.openframe.data.repository.packagesearch;

import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import org.springframework.data.domain.Sort;

import java.util.List;

public interface PackageCatalogRepositoryCustom {

    void upsertAll(List<PackageCatalogEntry> entries);

    List<PackageCatalogEntry> listByManager(PackageManagerType manager, Sort sort, int offset, int limit);
}
