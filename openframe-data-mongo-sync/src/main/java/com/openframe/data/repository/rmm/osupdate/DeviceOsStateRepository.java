package com.openframe.data.repository.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.DeviceOsState;
import com.openframe.data.document.rmm.osupdate.OsUpdateManageabilityState;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DeviceOsStateRepository extends MongoRepository<DeviceOsState, String> {

    Optional<DeviceOsState> findByTenantIdAndMachineId(String tenantId, String machineId);

    boolean existsByTenantIdAndMachineId(String tenantId, String machineId);

    long deleteByTenantIdAndMachineId(String tenantId, String machineId);

    @Query(fields = "{ 'machineId': 1 }")
    List<DeviceOsState> findByTenantIdAndManageabilityState(String tenantId,
                                                            OsUpdateManageabilityState manageabilityState);
}
