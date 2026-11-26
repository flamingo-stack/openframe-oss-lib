package com.openframe.data.repository.rmm.osupdate;

import java.time.Instant;

public interface CustomDeviceOsUpdateRolloutStateRepository {

    // Devices that may install at least one of their pending updates by now. organizationId null = every customer.
    long countDevicesWithInstallDue(String tenantId, String organizationId, Instant now);

    // Devices with a pending update past its hard restart deadline. organizationId null = every customer.
    OsUpdateOverdueDeviceCounts countOverdueDevices(String tenantId, String organizationId, Instant now);
}
