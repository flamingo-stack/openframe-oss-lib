package com.openframe.data.repository.packagesearch;

import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.time.Instant;
import java.util.Collection;
import java.util.List;

public interface PackageCatalogRepository extends MongoRepository<PackageCatalogEntry, String>, PackageCatalogRepositoryCustom {

    List<PackageCatalogEntry> findByManager(PackageManagerType manager);

    List<PackageCatalogEntry> findByManagerAndPackageIdIgnoreCase(PackageManagerType manager, String packageId);

    List<PackageCatalogEntry> findByManagerAndPackageIdIn(PackageManagerType manager, Collection<String> packageIds);

    // partial entries, every other field is null: add a field here before reading it from a matched cask
    @Query(fields = "{ 'manager': 1, 'packageId': 1, 'name': 1, 'version': 1, 'brewType': 1, 'popularity': 1,"
            + " 'aliases': 1, 'appNames': 1, 'weakAppNames': 1, 'bundleIds': 1, 'bundleIdPrefixes': 1 }")
    List<PackageCatalogEntry> findByManagerAndBrewType(PackageManagerType manager, BrewPackageType brewType);

    @Query("{ 'manager': ?0, '$or': [ { 'productCodes': { '$in': ?1 } }, { 'upgradeCodes': { '$in': ?2 } },"
            + " { 'packageFamilyNames': { '$in': ?3 } }, { 'normalizedNames': { '$in': ?4 } } ] }")
    List<PackageCatalogEntry> findByManagerAndAnyMatchingKey(PackageManagerType manager, Collection<String> productCodes,
                                                             Collection<String> upgradeCodes,
                                                             Collection<String> packageFamilyNames,
                                                             Collection<String> normalizedNames);

    long deleteByManagerAndUpdatedAtBefore(PackageManagerType manager, Instant updatedAt);
}
