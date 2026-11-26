package com.openframe.data.repository.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.DeviceOsState;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsUpdateManageabilityState;
import org.springframework.data.domain.Limit;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface DeviceOsStateRepository
        extends MongoRepository<DeviceOsState, String>, CustomDeviceOsStateRepository {

    Optional<DeviceOsState> findByTenantIdAndMachineId(String tenantId, String machineId);

    boolean existsByTenantIdAndMachineId(String tenantId, String machineId);

    long deleteByTenantIdAndMachineId(String tenantId, String machineId);

    @Query(fields = "{ 'machineId': 1 }")
    List<DeviceOsState> findByTenantIdAndManageabilityState(String tenantId,
                                                            OsUpdateManageabilityState manageabilityState);

    @Query(value = "{ 'tenantId': ?0, 'platform': ?1, 'osVersion': ?2, 'machineId': { $gt: ?3 } }",
            sort = "{ 'machineId': 1 }")
    List<DeviceOsState> findOsVersionDevicePage(String tenantId, OsPlatform platform, String osVersion,
                                                String afterMachineId, Limit limit);

    @Query(value = "{ 'tenantId': ?0, 'platform': ?1, 'osVersion': ?2, 'machineId': { $gt: ?3, $in: ?4 } }",
            sort = "{ 'machineId': 1 }")
    List<DeviceOsState> findOsVersionDevicePageOnMachines(String tenantId, OsPlatform platform, String osVersion,
                                                          String afterMachineId, Collection<String> machineIds,
                                                          Limit limit);
}
