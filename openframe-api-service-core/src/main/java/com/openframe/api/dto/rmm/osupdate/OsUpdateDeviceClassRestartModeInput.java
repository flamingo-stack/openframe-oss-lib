package com.openframe.api.dto.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsUpdateDeviceClass;
import com.openframe.data.document.rmm.osupdate.OsUpdateRestartMode;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OsUpdateDeviceClassRestartModeInput {

    private OsUpdateDeviceClass deviceClass;
    private OsUpdateRestartMode mode;
}
