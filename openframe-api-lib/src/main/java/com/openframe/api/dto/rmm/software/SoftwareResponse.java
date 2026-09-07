package com.openframe.api.dto.rmm.software;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Aggregate software row — one per software title, rolled up across the tenant's fleet. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SoftwareResponse {
    private String id;
    private String name;
    private String publisher;
    private SoftwareType type;
    private SoftwareSource source;
    private String currentVersion;
    private String latestVersion;
    private SoftwareVersionStatus versionStatus;
    private Integer olderVersionsCount;
    private Integer devicesCount;
    private SoftwareVulnerabilitySummaryResponse vulnerabilitySummary;
    private Boolean cpeMatched;
}
