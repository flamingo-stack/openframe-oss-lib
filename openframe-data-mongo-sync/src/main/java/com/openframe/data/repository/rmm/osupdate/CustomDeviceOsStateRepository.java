package com.openframe.data.repository.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsPlatform;

import java.util.Collection;
import java.util.List;

public interface CustomDeviceOsStateRepository {

    // Highest OS version first. machineIds null = every device.
    List<OsVersionDeviceCounts> findOsVersionPage(OsPlatform platform, Collection<String> machineIds, String cursor,
                                                  int limit, String tenantId);

    // The devices of the platform that we can manage. machineIds null = every device.
    ManageableOsDeviceCounts countManageableDevices(String tenantId, OsPlatform platform,
                                                    Collection<String> machineIds);
}
