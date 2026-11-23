package com.openframe.data.repository.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateHistoryEntry;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DeviceOsUpdateHistoryRepository
        extends MongoRepository<DeviceOsUpdateHistoryEntry, String>, CustomDeviceOsUpdateHistoryRepository {

    long deleteByTenantIdAndMachineId(String tenantId, String machineId);
}
