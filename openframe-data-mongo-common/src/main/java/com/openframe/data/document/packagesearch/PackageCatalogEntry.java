package com.openframe.data.document.packagesearch;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.TypeAlias;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;
import java.util.Locale;

// public package-manager catalog stored once in the shared database; written by the management
// services' sync jobs, read by the api services; not TenantScoped on purpose
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "package_catalog")
@TypeAlias("packageCatalogEntry")
public class PackageCatalogEntry {

    @Id
    private String id;
    private String manager;
    private String packageId;
    private String name;
    private String description;
    private String homepage;
    private String version;
    private String license;
    private String publisher;
    private String brewType;
    private String hashPrefix;
    private Integer popularity;
    private List<String> aliases;
    private String searchBlob;
    private Instant updatedAt;

    public static String entryId(PackageManagerType manager, BrewPackageType brewType, String packageId) {
        String lowerId = packageId.toLowerCase(Locale.ROOT);
        String managerName = manager.name();
        return brewType == null
                ? managerName + ":" + lowerId
                : managerName + ":" + brewType.name() + ":" + lowerId;
    }
}
