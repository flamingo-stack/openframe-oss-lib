package com.openframe.data.repository.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.DeviceOsPendingUpdate;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface DeviceOsPendingUpdateRepository
        extends MongoRepository<DeviceOsPendingUpdate, String>, CustomDeviceOsPendingUpdateRepository {

    List<DeviceOsPendingUpdate> findByTenantIdAndMachineIdOrderByDiscoveredAtDescIdentifierAsc(
            String tenantId, String machineId);

    long deleteByTenantIdAndMachineIdAndIdentifierNotIn(
            String tenantId, String machineId, Collection<String> identifiers);

    long deleteByTenantIdAndMachineId(String tenantId, String machineId);
}
