package com.openframe.data.repository.rmm.software;

import com.openframe.data.document.rmm.software.Software;

import java.util.List;

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
