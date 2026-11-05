package com.openframe.data.repository.packagesearch;

import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;

public interface PackageCatalogRepository extends MongoRepository<PackageCatalogEntry, String>, PackageCatalogRepositoryCustom {

    List<PackageCatalogEntry> findByManagerAndPackageIdIgnoreCase(PackageManagerType manager, String packageId);

    List<PackageCatalogEntry> findByManagerAndPackageIdIn(PackageManagerType manager, Collection<String> packageIds);

    List<PackageCatalogEntry> findByManagerAndUpgradeCodesIn(PackageManagerType manager, Collection<String> upgradeCodes);

    List<PackageCatalogEntry> findByManagerAndNormalizedNamesIn(PackageManagerType manager,
                                                                Collection<String> normalizedNames);

    long deleteByManagerAndUpdatedAtBefore(PackageManagerType manager, Instant updatedAt);
}
