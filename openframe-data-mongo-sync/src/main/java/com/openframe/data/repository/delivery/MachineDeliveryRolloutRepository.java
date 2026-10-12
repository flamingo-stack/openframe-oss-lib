package com.openframe.data.repository.delivery;

import com.openframe.data.document.delivery.DeliveryRolloutStatus;
import com.openframe.data.document.delivery.MachineDeliveryRollout;
import com.openframe.data.repository.TenantAwareRepository;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.data.mongodb.repository.Update;

import java.util.List;

@TenantAwareRepository
public interface MachineDeliveryRolloutRepository extends MongoRepository<MachineDeliveryRollout, String> {

    List<MachineDeliveryRollout> findByStatus(DeliveryRolloutStatus status);

    // the batch belongs to the rollout it was read from: a newer rollout under the same id has another sequence and
    // keeps its own cursor
    @Query("{ '_id': ?0, 'sequence': ?1 }")
    @Update("{ '$set': { 'cursor': ?2 }, '$inc': { 'dispatched': ?3 } }")
    long advance(String id, int sequence, String cursor, int dispatched);

    @Query("{ '_id': ?0, 'sequence': ?1 }")
    @Update("{ '$set': { 'status': 'DONE' }, '$inc': { 'dispatched': ?2 } }")
    long finish(String id, int sequence, int dispatched);
}
