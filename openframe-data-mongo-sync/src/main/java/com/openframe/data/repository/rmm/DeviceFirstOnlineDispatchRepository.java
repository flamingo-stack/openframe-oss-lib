package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.DeviceFirstOnlineDispatch;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.data.mongodb.repository.Update;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;

@Repository
public interface DeviceFirstOnlineDispatchRepository extends MongoRepository<DeviceFirstOnlineDispatch, String> {

    boolean existsByTenantIdAndMachineId(String tenantId, String machineId);

    long deleteByTenantIdAndMachineId(String tenantId, String machineId);

    List<DeviceFirstOnlineDispatch> findByDispatchedAtIsNull(Pageable pageable);

    @Query("{ '_id': { '$in': ?0 } }")
    @Update("{ '$set': { 'dispatchedAt': ?1 } }")
    long markDispatchedIn(Collection<String> ids, Instant dispatchedAt);
}
