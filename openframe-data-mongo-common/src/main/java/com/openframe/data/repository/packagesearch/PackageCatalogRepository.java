package com.openframe.data.repository.packagesearch;

import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.annotation.Collation;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.Instant;
import java.util.List;

public interface PackageCatalogRepository extends MongoRepository<PackageCatalogEntry, String>, PackageCatalogRepositoryCustom {

    // searchBlob is pre-lowered by the sync side, so the fragment must arrive lower-cased
    List<PackageCatalogEntry> findByManagerAndSearchBlobContaining(PackageManagerType manager, String searchBlobFragment);

    List<PackageCatalogEntry> findByManagerAndPackageIdIgnoreCase(PackageManagerType manager, String packageId);

    long deleteByManagerAndUpdatedAtBefore(PackageManagerType manager, Instant updatedAt);

    @Collation("{ 'locale': 'en', 'strength': 2 }")
    List<PackageCatalogEntry> findByManager(PackageManagerType manager, Pageable pageable);

    long countByManager(PackageManagerType manager);
}
