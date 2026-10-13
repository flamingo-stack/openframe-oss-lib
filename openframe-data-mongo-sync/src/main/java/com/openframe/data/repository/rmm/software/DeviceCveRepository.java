package com.openframe.data.repository.rmm.software;

import com.openframe.data.document.rmm.software.DeviceCve;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DeviceCveRepository extends MongoRepository<DeviceCve, String> {

    List<DeviceCve> findByTenantIdAndMachineId(String tenantId, String machineId);

    List<DeviceCve> findByTenantIdAndCveId(String tenantId, String cveId);

    long deleteByTenantIdAndMachineIdAndCveIdAndSoftwareTitleId(
            String tenantId, String machineId, String cveId, Long softwareTitleId);

    long deleteByTenantIdAndMachineId(String tenantId, String machineId);
}
