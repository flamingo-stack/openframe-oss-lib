package com.openframe.api.dto.rmm.osupdate;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class OsUpdateDeviceCounts {

    public static final OsUpdateDeviceCounts NONE = OsUpdateDeviceCounts.builder().build();

    int pendingDeviceCount;
    int installedDeviceCount;
}
