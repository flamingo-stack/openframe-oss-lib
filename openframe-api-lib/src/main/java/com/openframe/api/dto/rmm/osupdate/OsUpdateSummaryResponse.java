package com.openframe.api.dto.rmm.osupdate;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class OsUpdateSummaryResponse {

    private int deviceCount;
    private int currentDeviceCount;
    private int overdueDeviceCount;
    private int overdueOfflineDeviceCount;
    private int restartPendingDeviceCount;
    private int heldUpdateCount;
}
