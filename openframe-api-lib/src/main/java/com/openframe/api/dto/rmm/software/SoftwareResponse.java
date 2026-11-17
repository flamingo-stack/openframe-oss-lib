package com.openframe.api.dto.rmm.software;

import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.rmm.software.FleetSource;
import com.openframe.data.document.rmm.software.SoftwareAutoUpdateStatus;
import com.openframe.data.document.rmm.software.SoftwarePackageMatch;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SoftwareResponse {
    private String id;
    private String name;
    private String publisher;
    private SoftwareSource source;
    private SoftwareType type;
    private String currentVersion;
    private String latestVersion;
    private SoftwareVersionStatus versionStatus;
    private Integer olderVersionsCount;
    private Integer devicesCount;
    private SoftwareVulnerabilitySummaryResponse vulnerabilitySummary;
    private Boolean cpeMatched;
    private SoftwareAutoUpdateStatus autoUpdate;
    // not in the GraphQL schema: the osquery table Fleet took the row from, the keys a package manager matches the
    // program by, the match the read model stored for it, and the catalog package that manages the title
    private FleetSource fleetSource;
    private String upgradeCode;
    private String bundleIdentifier;
    private List<String> productCodes;
    private List<String> packageFamilyNames;
    private Boolean systemComponent;
    private SoftwarePackageMatch packageMatch;
    private PackageCatalogEntry managingPackage;
}
