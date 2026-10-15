package com.openframe.data.repository.rmm.software;

import com.openframe.data.document.rmm.software.DeviceSoftware;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DeviceSoftwareRepository extends MongoRepository<DeviceSoftware, String> {

    Optional<DeviceSoftware> findByTenantIdAndMachineIdAndSoftwareId(
            String tenantId, String machineId, Long softwareId);

    long deleteByTenantIdAndMachineIdAndSoftwareId(String tenantId, String machineId, Long softwareId);

    List<DeviceSoftware> findBySoftwareId(Long softwareId);

    Optional<DeviceSoftware> findByTenantIdAndMachineIdAndSoftwareTitleId(
            String tenantId, String machineId, Long softwareTitleId);

    List<DeviceSoftware> findByTenantIdAndMachineId(String tenantId, String machineId);

    List<DeviceSoftware> findByTenantIdAndSoftwareTitleId(String tenantId, Long softwareTitleId);

    long countByTenantIdAndSoftwareTitleId(String tenantId, Long softwareTitleId);

    long deleteByTenantIdAndMachineIdAndSoftwareTitleId(
            String tenantId, String machineId, Long softwareTitleId);

    long deleteByTenantIdAndMachineId(String tenantId, String machineId);
}
