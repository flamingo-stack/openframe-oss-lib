package com.openframe.data.repository.rmm.software;

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
        Map<String, Integer> devicesByVersion) {
}
