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
import java.util.Set;

@ConditionalOnProperty(name = "openframe.tenant-isolation.enabled", havingValue = "true")
public class CustomMachineDeliveryRepositoryImpl extends TenantAwareRepositorySupport
        implements CustomMachineDeliveryRepository {

    private static final String FIELD_ID = "_id";
    private static final String FIELD_MACHINE_ID = "machineId";
    private static final String FIELD_STATUS = "status";
    private static final String FIELD_ATTEMPTS = "attempts";
    private static final String FIELD_LAST_ATTEMPT_AT = "lastAttemptAt";
    private static final String FIELD_DUE_AT = "dueAt";
    private static final String FIELD_ACKED_AT = "ackedAt";
    private static final String FIELD_FINISHED_AT = "finishedAt";
    private static final String FIELD_EXPIRES_AT = "expiresAt";
    private static final String FIELD_FAILURE = "failure";

    public CustomMachineDeliveryRepositoryImpl(TenantAwareMongoTemplate mongoTemplate) {
        super(mongoTemplate);
    }

    @Override
    public boolean markRepublished(String id, Set<DeliveryStatus> from, Instant attemptAt, Instant dueAt) {
        Update update = new Update()
                .inc(FIELD_ATTEMPTS, 1)
                .set(FIELD_LAST_ATTEMPT_AT, attemptAt)
                .set(FIELD_DUE_AT, dueAt);
        return transition(id, from, update);
    }

    @Override
    public boolean postpone(String id, Set<DeliveryStatus> from, Instant dueAt) {
        Update update = new Update().set(FIELD_DUE_AT, dueAt);
        return transition(id, from, update);
    }

    @Override
    public boolean markAcked(String id, Set<DeliveryStatus> from, Instant ackedAt, Instant dueAt) {
        Update update = new Update()
                .set(FIELD_STATUS, DeliveryStatus.ACKED)
                .set(FIELD_ACKED_AT, ackedAt)
                .set(FIELD_DUE_AT, dueAt);
        return transition(id, from, update);
    }

    @Override
    public boolean markDone(String id, Set<DeliveryStatus> from, Instant finishedAt, Instant expiresAt) {
        Update update = closed(DeliveryStatus.DONE, finishedAt, expiresAt);
        return transition(id, from, update);
    }

    @Override
    public boolean markCancelled(String id, Set<DeliveryStatus> from, Instant finishedAt, Instant expiresAt) {
        Update update = closed(DeliveryStatus.CANCELLED, finishedAt, expiresAt);
        return transition(id, from, update);
    }

    @Override
    public boolean markFailed(String id, Set<DeliveryStatus> from, DeliveryFailure failure, Instant finishedAt, Instant expiresAt) {
        Update update = closed(DeliveryStatus.FAILED, finishedAt, expiresAt)
                .set(FIELD_FAILURE, failure);
        return transition(id, from, update);
    }

    @Override
    public long wake(String machineId, Set<DeliveryStatus> from, Instant dueAt) {
        Criteria laterRowsOfMachine = Criteria.where(FIELD_MACHINE_ID).is(machineId)
                .and(FIELD_STATUS).in(from)
                .and(FIELD_DUE_AT).gt(dueAt);
        Query query = new Query(laterRowsOfMachine);
        Update update = new Update().set(FIELD_DUE_AT, dueAt);
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
