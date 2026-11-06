package com.openframe.api.dto.rmm.software;

import com.openframe.data.document.rmm.software.SoftwareAutoUpdateStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

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
    // not in the GraphQL schema: the osquery table Fleet took the row from, picks the package matcher
    private String fleetSource;
    // not in the GraphQL schema: the program's MSI UpgradeCode and ARP key, what winget matches it by
    private String upgradeCode;
    private String productCode;
}
