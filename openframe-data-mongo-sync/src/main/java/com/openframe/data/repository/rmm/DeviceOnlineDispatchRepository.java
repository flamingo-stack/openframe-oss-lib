package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.DeviceFirstOnlineDispatch;
import com.openframe.data.document.rmm.DeviceOnlineDispatchStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface DeviceOnlineDispatchRepository extends MongoRepository<DeviceFirstOnlineDispatch, String> {

    List<DeviceFirstOnlineDispatch> findByStatus(DeviceOnlineDispatchStatus status, Pageable pageable);

    Optional<DeviceFirstOnlineDispatch> findByTenantIdAndMachineIdAndScheduleId(String tenantId, String machineId, String scheduleId);

    long deleteByTenantIdAndScheduleIdAndMachineIdIn(String tenantId, String scheduleId, Collection<String> machineIds);

    long deleteByTenantIdAndMachineId(String tenantId, String machineId);
}
