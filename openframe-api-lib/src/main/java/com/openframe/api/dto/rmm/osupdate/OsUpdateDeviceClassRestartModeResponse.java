package com.openframe.api.dto.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsUpdateDeviceClass;
import com.openframe.data.document.rmm.osupdate.OsUpdateRestartMode;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class OsUpdateDeviceClassRestartModeResponse {

    private OsUpdateDeviceClass deviceClass;
    private OsUpdateRestartMode mode;
}
