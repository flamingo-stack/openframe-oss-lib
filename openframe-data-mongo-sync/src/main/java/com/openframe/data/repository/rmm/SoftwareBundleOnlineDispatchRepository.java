package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.schedule.DeviceOnlineDispatchStatus;
import com.openframe.data.document.rmm.software.SoftwareBundleOnlineDispatch;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SoftwareBundleOnlineDispatchRepository extends MongoRepository<SoftwareBundleOnlineDispatch, String> {

    List<SoftwareBundleOnlineDispatch> findByStatus(DeviceOnlineDispatchStatus status, Pageable pageable);

    long countByStatus(DeviceOnlineDispatchStatus status);

    Optional<SoftwareBundleOnlineDispatch> findByTenantIdAndMachineIdAndBundleId(String tenantId, String machineId, String bundleId);

    long deleteByTenantIdAndBundleId(String tenantId, String bundleId);
}
