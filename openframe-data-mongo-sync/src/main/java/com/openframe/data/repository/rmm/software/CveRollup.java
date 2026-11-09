package com.openframe.data.repository.rmm.software;

import java.util.List;

// One CVE across the tenant's connected machines. devicesCount is distinct machines: a machine affected through two
// titles counts once overall and once in each title.
public record CveRollup(int devicesCount, List<Title> titles) {

    public record Title(Long softwareTitleId, String name, String source, String installedVersion, int devicesCount) {
    }
}
