package com.openframe.data.repository.delivery.impl;

import com.mongodb.client.result.UpdateResult;
import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryStatus;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.mongo.TenantAwareMongoTemplate;
import com.openframe.data.repository.TenantAwareRepositorySupport;
import com.openframe.data.repository.delivery.CustomMachineDeliveryRepository;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.time.Instant;
import java.util.EnumSet;
import java.util.Set;

@ConditionalOnProperty(name = "openframe.tenant-isolation.enabled", havingValue = "true")
public class CustomMachineDeliveryRepositoryImpl extends TenantAwareRepositorySupport
        implements CustomMachineDeliveryRepository {

    private static final String FIELD_ID = "_id";
    private static final String FIELD_MACHINE_ID = "machineId";
    private static final String FIELD_STATUS = "status";
    private static final String FIELD_ATTEMPTS = "attempts";
    private static final String FIELD_LAST_ATTEMPT_AT = "lastAttemptAt";
    private static final String FIELD_NEXT_ATTEMPT_AT = "nextAttemptAt";
    private static final String FIELD_ACKED_AT = "ackedAt";
    private static final String FIELD_FINISHED_AT = "finishedAt";
    private static final String FIELD_EXPIRES_AT = "expiresAt";
    private static final String FIELD_FAILURE = "failure";

    private static final Set<DeliveryStatus> PENDING_ONLY = EnumSet.of(DeliveryStatus.PENDING);
    private static final Set<DeliveryStatus> OPEN = EnumSet.of(DeliveryStatus.PENDING, DeliveryStatus.ACKED);

    public CustomMachineDeliveryRepositoryImpl(TenantAwareMongoTemplate mongoTemplate) {
        super(mongoTemplate);
    }

    @Override
    public boolean markRepublished(String id, Instant attemptAt, Instant nextAttemptAt) {
        Update update = new Update()
                .inc(FIELD_ATTEMPTS, 1)
                .set(FIELD_LAST_ATTEMPT_AT, attemptAt)
                .set(FIELD_NEXT_ATTEMPT_AT, nextAttemptAt);
        return transition(id, PENDING_ONLY, update);
    }

    @Override
    public boolean postpone(String id, Instant nextAttemptAt) {
        Update update = new Update().set(FIELD_NEXT_ATTEMPT_AT, nextAttemptAt);
        return transition(id, PENDING_ONLY, update);
    }

    @Override
    public boolean markAcked(String id, Instant ackedAt) {
        Update update = new Update()
                .set(FIELD_STATUS, DeliveryStatus.ACKED)
                .set(FIELD_ACKED_AT, ackedAt);
        return transition(id, PENDING_ONLY, update);
    }

    @Override
    public boolean markDone(String id, Instant finishedAt, Instant expiresAt) {
        Update update = closed(DeliveryStatus.DONE, finishedAt, expiresAt);
        return transition(id, OPEN, update);
    }

    @Override
    public boolean markCancelled(String id, Instant finishedAt, Instant expiresAt) {
        Update update = closed(DeliveryStatus.CANCELLED, finishedAt, expiresAt);
        return transition(id, OPEN, update);
    }

    @Override
    public boolean markFailed(String id, DeliveryFailure failure, Instant finishedAt, Instant expiresAt) {
        Update update = closed(DeliveryStatus.FAILED, finishedAt, expiresAt)
                .set(FIELD_FAILURE, failure);
        return transition(id, OPEN, update);
    }

    @Override
    public long wake(String machineId, Instant nextAttemptAt) {
        Criteria parkedForMachine = Criteria.where(FIELD_MACHINE_ID).is(machineId)
                .and(FIELD_STATUS).is(DeliveryStatus.PENDING)
                .and(FIELD_NEXT_ATTEMPT_AT).gt(nextAttemptAt);
        Query query = new Query(parkedForMachine);
        Update update = new Update().set(FIELD_NEXT_ATTEMPT_AT, nextAttemptAt);
        UpdateResult result = mongoTemplate.updateMulti(query, update, MachineDelivery.class);
        return result.getModifiedCount();
    }

    private static Update closed(DeliveryStatus status, Instant finishedAt, Instant expiresAt) {
        return new Update()
                .set(FIELD_STATUS, status)
                .set(FIELD_FINISHED_AT, finishedAt)
                .set(FIELD_EXPIRES_AT, expiresAt);
    }

    private boolean transition(String id, Set<DeliveryStatus> from, Update update) {
        Criteria rowStillIn = Criteria.where(FIELD_ID).is(id).and(FIELD_STATUS).in(from);
        Query query = new Query(rowStillIn);
        UpdateResult result = mongoTemplate.updateFirst(query, update, MachineDelivery.class);
        return result.getModifiedCount() > 0;
    }
}
