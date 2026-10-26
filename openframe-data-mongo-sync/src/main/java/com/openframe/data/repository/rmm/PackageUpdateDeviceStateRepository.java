package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.software.PackageUpdateDeviceState;
import com.openframe.data.document.rmm.software.SoftwareActionStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface PackageUpdateDeviceStateRepository extends MongoRepository<PackageUpdateDeviceState, String> {

    Optional<PackageUpdateDeviceState> findByTenantIdAndRequestIdAndMachineId(String tenantId, String requestId, String machineId);

    List<PackageUpdateDeviceState> findByTenantIdAndRequestId(String tenantId, String requestId);

    List<PackageUpdateDeviceState> findByStatusAndForcedFalseAndDeadlineAtBefore(
            SoftwareActionStatus status, Instant deadlineBefore, Pageable pageable);

    long deleteByTenantIdAndRequestId(String tenantId, String requestId);
}
