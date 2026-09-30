package com.openframe.data.document.packagesearch;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.TypeAlias;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

// public package-manager catalog stored once in the shared database; written by the management
// services' sync jobs, read by the api services; not TenantScoped on purpose
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "package_catalog")
@TypeAlias("packageCatalogEntry")
// collation must match PackageCatalogRepository.findByManager, or the unfiltered listing scans the collection
@CompoundIndexes({
        @CompoundIndex(name = "manager_popularity_packageId_ci", def = "{'manager': 1, 'popularity': -1, 'packageId': 1}",
                collation = "{'locale': 'en', 'strength': 2}"),
        @CompoundIndex(name = "manager_name_packageId_ci", def = "{'manager': 1, 'name': 1, 'packageId': 1}",
                collation = "{'locale': 'en', 'strength': 2}")
})
public class PackageCatalogEntry {

    @Id
    private String id;
    @Indexed(name = "manager_1")
    private PackageManagerType manager;
    private String packageId;
    private String name;
    private String description;
    private String homepage;
    private String version;
    private String license;
    private String publisher;
    private BrewPackageType brewType;
    private String hashPrefix;
    private Integer popularity;
    private List<String> aliases;
    private String searchBlob;
    private Instant updatedAt;

}
