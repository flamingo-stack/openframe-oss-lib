package com.openframe.data.repository.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.DeviceOsState;

public interface CustomDeviceOsStateRepository {

    boolean upsertUnlessNewerStored(DeviceOsState state);
}
