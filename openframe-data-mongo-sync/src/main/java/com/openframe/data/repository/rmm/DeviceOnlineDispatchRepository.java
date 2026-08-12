package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.DeviceFirstOnlineDispatch;
import com.openframe.data.document.rmm.DeviceOnlineDispatchStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.data.mongodb.repository.Update;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;

@Repository
public interface DeviceOnlineDispatchRepository extends MongoRepository<DeviceFirstOnlineDispatch, String> {

    boolean existsByTenantIdAndMachineId(String tenantId, String machineId);

    long deleteByTenantIdAndMachineId(String tenantId, String machineId);

    List<DeviceFirstOnlineDispatch> findByStatus(DeviceOnlineDispatchStatus status, Pageable pageable);

    /** Bulk status write for the given rows. Caller decides the target status + dispatch time. */
    @Query("{ '_id': { '$in': ?0 } }")
    @Update("{ '$set': { 'dispatchedAt': ?1, 'status': ?2 } }")
    long markDispatchedIn(Collection<String> ids, Instant dispatchedAt, DeviceOnlineDispatchStatus status);

    /** Guarded status transition for a single machine's sentinel: match {@code expected}, set {@code target}. */
    @Query("{ 'tenantId': ?0, 'machineId': ?1, 'status': ?2 }")
    @Update("{ '$set': { 'status': ?3 } }")
    long markProcessed(String tenantId, String machineId, DeviceOnlineDispatchStatus expected, DeviceOnlineDispatchStatus target);
}
