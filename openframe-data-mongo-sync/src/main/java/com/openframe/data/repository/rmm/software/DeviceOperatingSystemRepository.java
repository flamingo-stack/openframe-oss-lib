package com.openframe.data.repository.rmm.software;

import com.openframe.data.document.rmm.software.DeviceOperatingSystem;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DeviceOperatingSystemRepository extends MongoRepository<DeviceOperatingSystem, String> {

    Optional<DeviceOperatingSystem> findByTenantIdAndMachineId(String tenantId, String machineId);

    List<DeviceOperatingSystem> findByOsId(Long osId);

    long deleteByTenantIdAndMachineId(String tenantId, String machineId);
}
