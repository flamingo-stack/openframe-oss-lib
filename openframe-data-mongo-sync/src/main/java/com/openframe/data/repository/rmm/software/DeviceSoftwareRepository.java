package com.openframe.data.repository.rmm.software;

import com.openframe.data.document.rmm.software.DeviceSoftware;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.data.mongodb.repository.Update;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DeviceSoftwareRepository extends MongoRepository<DeviceSoftware, String> {

    Optional<DeviceSoftware> findByTenantIdAndMachineIdAndSoftwareTitleId(
            String tenantId, String machineId, Long softwareTitleId);

    List<DeviceSoftware> findByTenantIdAndMachineId(String tenantId, String machineId);

    List<DeviceSoftware> findByTenantIdAndSoftwareTitleIdAndMachineConnectedTrue(String tenantId, Long softwareTitleId);

    List<DeviceSoftware> findByTenantIdAndVulnerabilitiesContainingAndMachineConnectedTrue(String tenantId, String cveId);

    long deleteByTenantIdAndMachineId(String tenantId, String machineId);

    @Query("{ 'tenantId': ?0, 'machineId': ?1, 'machineConnected': { '$ne': ?2 } }")
    @Update("{ '$set': { 'machineConnected': ?2 } }")
    long setMachineConnectedByTenantIdAndMachineId(String tenantId, String machineId, boolean connected);
}
