package com.openframe.data.repository.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsUpdateManageabilityState;

import java.util.List;

public interface CustomDeviceOsStateRepository {

    List<String> findMachineIds(String tenantId, OsUpdateManageabilityState manageabilityState);
}
