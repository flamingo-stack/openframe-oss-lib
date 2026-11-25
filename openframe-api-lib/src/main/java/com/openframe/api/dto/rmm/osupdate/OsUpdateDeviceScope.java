package com.openframe.api.dto.rmm.osupdate;

import lombok.Value;

import java.util.List;

// The devices an OS update list and its counts look at, read once per request.
@Value
public class OsUpdateDeviceScope {

    public static final OsUpdateDeviceScope EVERY_DEVICE = new OsUpdateDeviceScope(null);

    // Null = every device of the tenant; empty = no device.
    List<String> machineIds;
}
