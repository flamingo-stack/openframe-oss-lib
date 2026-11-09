package com.openframe.data.repository.rmm.software;

import java.util.List;

public record CveRollup(int devicesCount, List<Title> titles) {

    public record Title(Long softwareTitleId, String name, String source, String installedVersion, int devicesCount) {
    }
}
