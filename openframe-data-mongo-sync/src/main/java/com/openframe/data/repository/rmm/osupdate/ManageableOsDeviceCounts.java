package com.openframe.data.repository.rmm.osupdate;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ManageableOsDeviceCounts {

    public static final ManageableOsDeviceCounts NONE = new ManageableOsDeviceCounts();

    private long deviceCount;
    // Of them, the devices that wait for a restart.
    private long rebootPendingDeviceCount;
}
