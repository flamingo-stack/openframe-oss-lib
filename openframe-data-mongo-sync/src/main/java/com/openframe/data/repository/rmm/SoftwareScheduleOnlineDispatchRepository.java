package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.schedule.DeviceOnlineDispatchStatus;
import com.openframe.data.document.rmm.schedule.SoftwareScheduleOnlineDispatch;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.data.mongodb.repository.ReadPreference;
import org.springframework.data.mongodb.repository.Update;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/** Stores software schedule runs waiting for their target devices to reconnect. */
@Repository
public interface SoftwareScheduleOnlineDispatchRepository extends MongoRepository<SoftwareScheduleOnlineDispatch, String> {

    List<SoftwareScheduleOnlineDispatch> findByStatus(DeviceOnlineDispatchStatus status, Pageable pageable);

    long countByStatus(DeviceOnlineDispatchStatus status);

    @ReadPreference("primary")
    Optional<SoftwareScheduleOnlineDispatch> findByTenantIdAndMachineIdAndScheduleId(String tenantId, String machineId, String scheduleId);

    List<SoftwareScheduleOnlineDispatch> findByTenantIdAndScheduleId(String tenantId, String scheduleId);

    long deleteByTenantIdAndScheduleId(String tenantId, String scheduleId);

    long deleteByTenantIdAndMachineIdAndStatus(String tenantId, String machineId, DeviceOnlineDispatchStatus status);

    @ReadPreference("primary")
    boolean existsOnPrimaryByTenantIdAndIdAndStatus(String tenantId, String id, DeviceOnlineDispatchStatus status);

    default long transitionIfNew(String tenantId, String id, DeviceOnlineDispatchStatus status, Instant dispatchedAt) {
        return transitionIfStatus(tenantId, id, DeviceOnlineDispatchStatus.NEW, status, dispatchedAt);
    }

    @Query("{ 'tenantId': ?0, '_id': ?1, 'status': ?2 }")
    @Update("{ '$set': { 'status': ?3, 'dispatchedAt': ?4 } }")
    long transitionIfStatus(String tenantId, String id, DeviceOnlineDispatchStatus currentStatus,
                            DeviceOnlineDispatchStatus nextStatus, Instant dispatchedAt);
}
