package com.openframe.data.repository.device;

import com.openframe.data.document.device.MachineFirstOnlineDispatch;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.data.mongodb.repository.Update;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface MachineFirstOnlineDispatchRepository
        extends MongoRepository<MachineFirstOnlineDispatch, String> {

    boolean existsByTenantIdAndMachineId(String tenantId, String machineId);

    List<MachineFirstOnlineDispatch> findByDispatchedAtIsNull();

    @Query("{ '_id': ?0 }")
    @Update("{ '$set': { 'dispatchedAt': ?1 } }")
    void markDispatched(String id, Instant dispatchedAt);
}
