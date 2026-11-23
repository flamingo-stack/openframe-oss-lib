package com.openframe.client.service.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.DeviceOsPendingUpdate;
import com.openframe.data.document.rmm.osupdate.DeviceOsState;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateHistoryEntry;
import com.openframe.data.document.rmm.osupdate.OsUpdate;
import lombok.Builder;
import lombok.Value;

import java.util.List;

// One report of one device, parsed: everything below is ready to be stored.
@Value
@Builder
public class DeviceOsReport {

    DeviceOsState deviceOsState;

    // false = the device could not read its updates: the stored pending updates stay as they are.
    boolean pendingUpdatesReadable;

    List<OsUpdate> osUpdates;

    List<DeviceOsPendingUpdate> pendingUpdates;

    List<DeviceOsUpdateHistoryEntry> historyEntries;
}
