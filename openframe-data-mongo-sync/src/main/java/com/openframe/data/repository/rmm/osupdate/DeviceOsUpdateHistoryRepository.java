package com.openframe.data.repository.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateHistoryEntry;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface DeviceOsUpdateHistoryRepository
        extends MongoRepository<DeviceOsUpdateHistoryEntry, String>, CustomDeviceOsUpdateHistoryRepository {

    List<DeviceOsUpdateHistoryEntry> findByTenantIdAndMachineIdAndEntryKeyIn(
            String tenantId, String machineId, Collection<String> entryKeys);

    long deleteByTenantIdAndMachineId(String tenantId, String machineId);
}
