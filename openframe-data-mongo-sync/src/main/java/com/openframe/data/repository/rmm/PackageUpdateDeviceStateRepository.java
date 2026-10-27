package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.software.PackageUpdateDeviceState;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PackageUpdateDeviceStateRepository extends MongoRepository<PackageUpdateDeviceState, String> {

    Optional<PackageUpdateDeviceState> findByTenantIdAndRequestIdAndMachineId(String tenantId, String requestId, String machineId);

    List<PackageUpdateDeviceState> findByTenantIdAndRequestId(String tenantId, String requestId);

    long deleteByTenantIdAndRequestId(String tenantId, String requestId);
}
