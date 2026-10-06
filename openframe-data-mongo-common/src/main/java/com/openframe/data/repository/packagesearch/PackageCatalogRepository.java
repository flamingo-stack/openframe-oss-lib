package com.openframe.data.repository.packagesearch;

import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.Instant;
import java.util.List;

public interface PackageCatalogRepository extends MongoRepository<PackageCatalogEntry, String>, PackageCatalogRepositoryCustom {

    List<PackageCatalogEntry> findByManagerAndPackageIdIgnoreCase(PackageManagerType manager, String packageId);

    long deleteByManagerAndUpdatedAtBefore(PackageManagerType manager, Instant updatedAt);
}
