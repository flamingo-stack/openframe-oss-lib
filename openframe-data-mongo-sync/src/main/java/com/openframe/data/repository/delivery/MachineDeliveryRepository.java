package com.openframe.data.repository.delivery;

import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryStatus;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.repository.TenantAwareRepository;
import org.springframework.data.domain.Limit;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.data.mongodb.repository.ReadPreference;
import org.springframework.data.mongodb.repository.Update;

import java.time.Instant;
import java.util.List;
import java.util.Set;

// every transition is a conditional update: the filter names the row, the statuses it may still be in and the dispatch
// it belongs to; 0 updated = the row moved on first, and the caller does nothing
@TenantAwareRepository
public interface MachineDeliveryRepository extends MongoRepository<MachineDelivery, String> {

    boolean existsByIdAndDispatchId(String id, String dispatchId);

    // primary on purpose: a lagging secondary shows a row the sweep already re-sent as still due
    @ReadPreference("primary")
    @Query(value = "{ 'status': ?0, 'dueAt': { '$lt': ?1 } }", sort = "{ 'dueAt': 1 }")
    List<MachineDelivery> findDue(DeliveryStatus status, Instant before, Limit limit);

    @Query("{ '_id': ?0, 'status': { '$in': ?1 }, 'dispatchedAt': ?2, 'attempts': ?3 }")
    @Update("{ '$inc': { 'attempts': 1 }, '$set': { 'dueAt': ?4 } }")
    long markRepublished(String id, Set<DeliveryStatus> from, Instant dispatchedAt, int attempts, Instant dueAt);

    @Query("{ '_id': ?0, 'status': { '$in': ?1 }, 'dispatchedAt': ?2 }")
    @Update("{ '$set': { 'dueAt': ?3 } }")
    long postpone(String id, Set<DeliveryStatus> from, Instant dispatchedAt, Instant dueAt);

    @Query("{ '_id': ?0, 'status': { '$in': ?1 }, 'dispatchedAt': ?2 }")
    @Update("{ '$inc': { 'errors': 1 }, '$set': { 'dueAt': ?3 } }")
    long postponeAfterError(String id, Set<DeliveryStatus> from, Instant dispatchedAt, Instant dueAt);

    @Query("{ '_id': ?0, 'dispatchId': ?1, 'status': { '$in': ?2 } }")
    @Update("{ '$set': { 'status': 'ACKED', 'ackedAt': ?3, 'dueAt': ?4 } }")
    long markAcked(String id, String dispatchId, Set<DeliveryStatus> from, Instant ackedAt, Instant dueAt);

    @Query("{ '_id': ?0, 'dispatchId': ?1, 'status': { '$in': ?2 } }")
    @Update("{ '$set': { 'status': 'DONE', 'finishedAt': ?3, 'expiresAt': ?4 }, '$unset': { 'payloadJson': 1 } }")
    long markDone(String id, String dispatchId, Set<DeliveryStatus> from, Instant finishedAt, Instant expiresAt);

    @Query("{ '_id': ?0, 'status': { '$in': ?1 }, 'dispatchedAt': ?2 }")
    @Update("{ '$set': { 'status': 'CANCELLED', 'finishedAt': ?3, 'expiresAt': ?4 }, '$unset': { 'payloadJson': 1 } }")
    long markCancelled(String id, Set<DeliveryStatus> from, Instant dispatchedAt, Instant finishedAt, Instant expiresAt);

    @Query("{ '_id': ?0, 'status': { '$in': ?1 }, 'dispatchedAt': ?2 }")
    @Update("{ '$set': { 'status': 'FAILED', 'failure': ?3, 'finishedAt': ?4, 'expiresAt': ?5 }, '$unset': { 'payloadJson': 1 } }")
    long markFailed(String id, Set<DeliveryStatus> from, Instant dispatchedAt, DeliveryFailure failure, Instant finishedAt, Instant expiresAt);

    @Query("{ '_id': ?0, 'dispatchId': ?1, 'status': { '$in': ?2 } }")
    @Update("{ '$set': { 'status': 'FAILED', 'failure': ?3, 'error': ?4, 'finishedAt': ?5, 'expiresAt': ?6 }, '$unset': { 'payloadJson': 1 } }")
    long markFailed(String id, String dispatchId, Set<DeliveryStatus> from, DeliveryFailure failure, String error, Instant finishedAt, Instant expiresAt);
}
