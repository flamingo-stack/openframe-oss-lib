package com.openframe.data.repository.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateHistoryEntry;
import com.openframe.data.document.rmm.osupdate.OsUpdateInstallResult;
import com.openframe.data.document.rmm.osupdate.OsUpdateOperation;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.Optional;

@Repository
public interface DeviceOsUpdateHistoryRepository
        extends MongoRepository<DeviceOsUpdateHistoryEntry, String>, CustomDeviceOsUpdateHistoryRepository {

    Optional<DeviceOsUpdateHistoryEntry> findFirstByTenantIdAndMachineIdAndOperationAndResultInOrderByInstalledAtDesc(
            String tenantId, String machineId, OsUpdateOperation operation, Collection<OsUpdateInstallResult> results);

    long deleteByTenantIdAndMachineId(String tenantId, String machineId);
}
