package com.openframe.data.repository.delivery.impl;

import com.mongodb.ReadPreference;
import com.mongodb.client.result.UpdateResult;
import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryStatus;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.mongo.TenantAwareMongoTemplate;
import com.openframe.data.repository.TenantAwareRepositorySupport;
import com.openframe.data.repository.delivery.CustomMachineDeliveryRepository;
import org.bson.Document;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.time.Instant;
import java.util.List;
import java.util.Set;

@ConditionalOnProperty(name = "openframe.tenant-isolation.enabled", havingValue = "true")
public class CustomMachineDeliveryRepositoryImpl extends TenantAwareRepositorySupport
        implements CustomMachineDeliveryRepository {

    private static final String FIELD_ID = "_id";
    private static final String FIELD_MACHINE_ID = "machineId";
    private static final String FIELD_STATUS = "status";
    private static final String FIELD_ATTEMPTS = "attempts";
    private static final String FIELD_PAYLOAD_JSON = "payloadJson";
    private static final String FIELD_DISPATCHED_AT = "dispatchedAt";
    private static final String FIELD_LAST_ATTEMPT_AT = "lastAttemptAt";
    private static final String FIELD_DUE_AT = "dueAt";
    private static final String FIELD_PARKED = "parked";
    private static final String FIELD_ACKED_AT = "ackedAt";
    private static final String FIELD_FINISHED_AT = "finishedAt";
    private static final String FIELD_EXPIRES_AT = "expiresAt";
    private static final String FIELD_FAILURE = "failure";

    private static final Sort OLDEST_DUE_FIRST = Sort.by(FIELD_DUE_AT);

    public CustomMachineDeliveryRepositoryImpl(TenantAwareMongoTemplate mongoTemplate) {
        super(mongoTemplate);
    }

    // primary read: a lagging secondary would show a row the sweep has already re-sent as still due
    @Override
    public List<MachineDelivery> findDue(DeliveryStatus status, Instant before, int limit) {
        Criteria due = Criteria.where(FIELD_STATUS).is(status).and(FIELD_DUE_AT).lt(before);
        Query query = new Query(due)
                .with(OLDEST_DUE_FIRST)
                .limit(limit)
                .withReadPreference(ReadPreference.primary());
        return mongoTemplate.find(query, MachineDelivery.class);
    }

    // tenant-scoped upsert by id: restarts our own open row, refuses (duplicate key) a foreign one
    @Override
    public void upsertPending(MachineDelivery delivery) {
        Document document = new Document();
        mongoTemplate.getConverter().write(delivery, document);
        Update update = Update.fromDocument(document, FIELD_ID);
        Query byId = new Query(Criteria.where(FIELD_ID).is(delivery.getId()));
        mongoTemplate.upsert(byId, update, MachineDelivery.class);
    }

    @Override
    public boolean markRepublished(String id, Set<DeliveryStatus> from, Instant dispatchedAt, Instant attemptAt, Instant dueAt) {
        Criteria sameDispatch = Criteria.where(FIELD_ID).is(id)
                .and(FIELD_STATUS).in(from)
                .and(FIELD_DISPATCHED_AT).is(dispatchedAt);
        Update update = new Update()
                .inc(FIELD_ATTEMPTS, 1)
                .set(FIELD_LAST_ATTEMPT_AT, attemptAt)
                .set(FIELD_DUE_AT, dueAt);
        return updateOne(sameDispatch, update);
    }

    @Override
    public boolean postpone(String id, Set<DeliveryStatus> from, Instant dueAt) {
        Update update = new Update().set(FIELD_DUE_AT, dueAt);
        return transition(id, from, update);
    }

    @Override
    public boolean park(String id, Set<DeliveryStatus> from, Instant dueAt) {
        Update update = new Update()
                .set(FIELD_DUE_AT, dueAt)
                .set(FIELD_PARKED, true);
        return transition(id, from, update);
    }

    @Override
    public boolean markAcked(String id, Set<DeliveryStatus> from, Instant ackedAt, Instant dueAt) {
        Update update = new Update()
                .set(FIELD_STATUS, DeliveryStatus.ACKED)
                .set(FIELD_ACKED_AT, ackedAt)
                .set(FIELD_DUE_AT, dueAt)
                .set(FIELD_PARKED, false);
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
        Criteria parkedRowsOfMachine = Criteria.where(FIELD_MACHINE_ID).is(machineId)
                .and(FIELD_STATUS).in(from)
                .and(FIELD_PARKED).is(true);
        Query query = new Query(parkedRowsOfMachine);
        Update update = new Update()
                .set(FIELD_DUE_AT, dueAt)
                .set(FIELD_PARKED, false);
        UpdateResult result = mongoTemplate.updateMulti(query, update, MachineDelivery.class);
        return result.getModifiedCount();
    }

    private static Update closed(DeliveryStatus status, Instant finishedAt, Instant expiresAt) {
        return new Update()
                .set(FIELD_STATUS, status)
                .set(FIELD_FINISHED_AT, finishedAt)
                .set(FIELD_EXPIRES_AT, expiresAt)
                .unset(FIELD_PAYLOAD_JSON);
    }

    private boolean transition(String id, Set<DeliveryStatus> from, Update update) {
        Criteria rowStillIn = Criteria.where(FIELD_ID).is(id).and(FIELD_STATUS).in(from);
        return updateOne(rowStillIn, update);
    }

    private boolean updateOne(Criteria criteria, Update update) {
        Query query = new Query(criteria);
        UpdateResult result = mongoTemplate.updateFirst(query, update, MachineDelivery.class);
        return result.getModifiedCount() > 0;
    }
}
