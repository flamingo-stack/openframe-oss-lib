package com.openframe.test.data.dto.software;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

// One software title, fleet-wide from softwares/software or scoped to one device from deviceSoftware (currentVersion is then this device's).
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class Software {
    private String id;
    private String name;
    private String publisher;
    private String source;
    private String currentVersion;
    private String latestVersion;
    private String versionStatus;
    private Integer olderVersionsCount;
    private Integer devicesCount;
    private SoftwareVulnerabilitySummary vulnerabilitySummary;
    private Boolean cpeMatched;

    // The title's CVE count, 0 when it has no vulnerability summary.
    public int cveCount() {
        return vulnerabilitySummary == null || vulnerabilitySummary.getCveCount() == null ? 0 : vulnerabilitySummary.getCveCount();
    }
}
