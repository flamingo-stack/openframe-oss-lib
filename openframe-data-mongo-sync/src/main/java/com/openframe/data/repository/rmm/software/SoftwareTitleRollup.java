package com.openframe.data.repository.rmm.software;

import com.openframe.data.document.rmm.software.Software;

import java.util.List;

// One software title across the tenant's connected machines. Name and source come from the first machine by id,
// vendor and upgrade code are the first non-blank ones; the key lists are unions without blanks, sorted.
public record SoftwareTitleRollup(
        int devicesCount,
        String name,
        String source,
        String vendor,
        String upgradeCode,
        List<String> versions,
        int cveCount,
        List<String> arpKeys,
        List<String> packageFamilyNames,
        List<String> installerTypes,
        boolean systemComponent,
        List<Software.Installation> installations) {
}
