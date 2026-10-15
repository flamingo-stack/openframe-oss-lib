package com.openframe.data.repository.rmm.software;

import com.openframe.data.document.rmm.software.DeviceCve;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DeviceCveRepository extends MongoRepository<DeviceCve, String> {

    Optional<DeviceCve> findByTenantIdAndMachineIdAndCveIdAndSoftwareId(
            String tenantId, String machineId, String cveId, Long softwareId);

    long deleteByTenantIdAndMachineIdAndCveIdAndSoftwareId(
            String tenantId, String machineId, String cveId, Long softwareId);

    long deleteByTenantIdAndMachineIdAndSoftwareId(String tenantId, String machineId, Long softwareId);

    long deleteByTenantIdAndMachineIdAndSoftwareIdIsNull(String tenantId, String machineId);

    List<DeviceCve> findByTenantIdAndMachineId(String tenantId, String machineId);

    List<DeviceCve> findByTenantIdAndCveId(String tenantId, String cveId);

    long deleteByTenantIdAndMachineId(String tenantId, String machineId);
}
