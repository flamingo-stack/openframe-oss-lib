package com.openframe.data.repository.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateRolloutState;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface DeviceOsUpdateRolloutStateRepository
        extends MongoRepository<DeviceOsUpdateRolloutState, String>, CustomDeviceOsUpdateRolloutStateRepository {

    List<DeviceOsUpdateRolloutState> findByTenantIdAndMachineIdIn(String tenantId, Collection<String> machineIds);

    List<DeviceOsUpdateRolloutState> findByTenantIdAndMachineId(String tenantId, String machineId);

    long deleteByTenantIdAndMachineId(String tenantId, String machineId);
}
