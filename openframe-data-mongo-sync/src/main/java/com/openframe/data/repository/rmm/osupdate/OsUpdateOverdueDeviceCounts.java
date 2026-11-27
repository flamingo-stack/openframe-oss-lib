package com.openframe.data.repository.rmm.osupdate;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class OsUpdateOverdueDeviceCounts {

    public static final OsUpdateOverdueDeviceCounts NONE = new OsUpdateOverdueDeviceCounts();

    private long deviceCount;
    // Of them, the devices that are not online now.
    private long offlineDeviceCount;
}
