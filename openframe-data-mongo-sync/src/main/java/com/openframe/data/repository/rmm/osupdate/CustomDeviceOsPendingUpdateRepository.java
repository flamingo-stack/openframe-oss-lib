package com.openframe.data.repository.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.DeviceOsPendingUpdate;
import com.openframe.data.document.rmm.osupdate.OsPlatform;

import java.util.Collection;
import java.util.List;

public interface CustomDeviceOsPendingUpdateRepository {

    // machineIds null = every device
    List<DeviceOsPendingUpdate> findDevicePage(String tenantId, OsPlatform platform, String identifier,
                                               Collection<String> excludedMachineIds, Collection<String> machineIds,
                                               String cursor, int limit);

    String encodeDeviceCursor(DeviceOsPendingUpdate pendingUpdate);

    // The devices each update is pending on, per customer. identifiers null = every update; machineIds null =
    // every device.
    List<OsUpdateOrganizationDeviceCount> countDevicesByIdentifierAndOrganization(
            String tenantId, OsPlatform platform, Collection<String> identifiers,
            Collection<String> excludedMachineIds, Collection<String> machineIds);
}
