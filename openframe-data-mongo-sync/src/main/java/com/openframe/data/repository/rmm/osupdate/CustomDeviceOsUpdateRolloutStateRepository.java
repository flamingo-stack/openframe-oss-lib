package com.openframe.data.repository.rmm.osupdate;

import java.time.Instant;
import java.util.Collection;

public interface CustomDeviceOsUpdateRolloutStateRepository {

    // Devices that may install at least one of their pending updates by now. No organizationIds = every customer.
    long countDevicesWithInstallDue(String tenantId, Collection<String> organizationIds, Instant now);

    // Devices with a pending update past its hard restart deadline. No organizationIds = every customer.
    OsUpdateOverdueDeviceCounts countOverdueDevices(String tenantId, Collection<String> organizationIds, Instant now);
}
