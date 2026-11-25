package com.openframe.api.dataloader;

import com.openframe.api.dto.rmm.osupdate.OsUpdateDeviceScope;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class OsUpdateDeviceCountsKey {

    String osUpdateId;
    OsUpdateDeviceScope osUpdateDeviceScope;
}
