package com.openframe.data.repository.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateHistoryEntry;

import java.util.Collection;
import java.util.List;

public interface CustomDeviceOsUpdateHistoryRepository {

    List<DeviceOsUpdateHistoryEntry> findPage(String tenantId, String machineId, String cursor, int limit);

    String encodeCursor(DeviceOsUpdateHistoryEntry historyEntry);

    // machineIds null = every device
    List<InstalledOsUpdateDevice> findInstalledDevicePage(String tenantId, String identifier,
                                                          Collection<String> machineIds, String cursor, int limit);

    String encodeInstalledDeviceCursor(InstalledOsUpdateDevice installedDevice);

    // The devices that installed each update, per customer. identifiers null = every update; machineIds null =
    // every device.
    List<OsUpdateOrganizationDeviceCount> countInstalledDevicesByIdentifierAndOrganization(
            String tenantId, Collection<String> identifiers, Collection<String> machineIds);
}
