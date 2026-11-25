package com.openframe.api.dto.device;

import lombok.Value;

@Value
public class DeviceWipe {
    boolean available;
    DeviceWipeStatus status;

    public static DeviceWipe unavailable() {
        return new DeviceWipe(false, DeviceWipeStatus.NOT_REQUESTED);
    }
}
