package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.schedule.DeviceOnlineDispatchStatus;
import com.openframe.data.document.rmm.schedule.SoftwareScheduleOnlineDispatch;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SoftwareScheduleOnlineDispatchRepository extends MongoRepository<SoftwareScheduleOnlineDispatch, String> {

    List<SoftwareScheduleOnlineDispatch> findByStatus(DeviceOnlineDispatchStatus status, Pageable pageable);

    long countByStatus(DeviceOnlineDispatchStatus status);

    Optional<SoftwareScheduleOnlineDispatch> findByTenantIdAndMachineIdAndScheduleId(String tenantId, String machineId, String scheduleId);

    long deleteByTenantIdAndScheduleId(String tenantId, String scheduleId);
}
