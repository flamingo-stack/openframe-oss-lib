package com.openframe.data.repository.rmm.software;

import com.openframe.data.document.rmm.software.Software;

import java.util.List;
import java.util.Map;

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
        Map<String, Integer> devicesByVersion,
        List<Software.Installation> installations) {
}
