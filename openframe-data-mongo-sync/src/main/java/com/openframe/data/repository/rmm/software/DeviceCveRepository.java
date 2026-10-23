package com.openframe.data.repository.rmm.software;

import com.openframe.data.document.rmm.software.DeviceCve;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DeviceCveRepository extends MongoRepository<DeviceCve, String> {

    Optional<DeviceCve> findByTenantIdAndMachineIdAndCveIdAndSoftwareTitleId(
            String tenantId, String machineId, String cveId, Long softwareTitleId);

    List<DeviceCve> findByTenantIdAndMachineId(String tenantId, String machineId);

    List<DeviceCve> findByTenantIdAndCveId(String tenantId, String cveId);

    List<DeviceCve> findByTenantIdAndSoftwareTitleId(String tenantId, Long softwareTitleId);

    long deleteByTenantIdAndMachineId(String tenantId, String machineId);
}
