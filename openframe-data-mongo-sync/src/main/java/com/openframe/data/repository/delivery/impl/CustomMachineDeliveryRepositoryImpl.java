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
    private static final String FIELD_TENANT_ID = "tenantId";
    private static final String FIELD_STATUS = "status";
    private static final String FIELD_ATTEMPTS = "attempts";
    private static final String FIELD_ERRORS = "errors";
    private static final String FIELD_DISPATCH_ID = "dispatchId";
    private static final String FIELD_PAYLOAD_JSON = "payloadJson";
    private static final String FIELD_DISPATCHED_AT = "dispatchedAt";
    private static final String FIELD_DUE_AT = "dueAt";
    private static final String FIELD_ACKED_AT = "ackedAt";
    private static final String FIELD_FINISHED_AT = "finishedAt";
    private static final String FIELD_EXPIRES_AT = "expiresAt";
    private static final String FIELD_FAILURE = "failure";
    private static final String FIELD_ERROR = "error";

    private static final Sort OLDEST_DUE_FIRST = Sort.by(FIELD_DUE_AT);

    public CustomMachineDeliveryRepositoryImpl(TenantAwareMongoTemplate mongoTemplate) {
        super(mongoTemplate);
    }

    // primary on purpose: a lagging secondary shows a row the sweep already re-sent as still due
    @Override
    public List<MachineDelivery> findDue(DeliveryStatus status, Instant before, int limit) {
        Criteria due = Criteria.where(FIELD_STATUS).is(status).and(FIELD_DUE_AT).lt(before);
        Query query = new Query(due)
                .with(OLDEST_DUE_FIRST)
                .limit(limit)
                .withReadPreference(ReadPreference.primary());
        return mongoTemplate.find(query, MachineDelivery.class);
    }

    // $set per field, not a replacement document: a replacement is inserted without the tenant of the scoped filter
    @Override
    public void upsertPending(MachineDelivery delivery) {
        Document document = new Document();
        mongoTemplate.getConverter().write(delivery, document);
        Update update = new Update().set(FIELD_TENANT_ID, tenantId());
        document.forEach((field, value) -> setField(update, field, value));
        String id = delivery.getId();
        Query byId = new Query(Criteria.where(FIELD_ID).is(id));
        mongoTemplate.upsert(byId, update, MachineDelivery.class);
    }

    @Override
    public boolean markRepublished(String id, Set<DeliveryStatus> from, Instant dispatchedAt, int attempts, Instant dueAt) {
        Criteria sameAttempt = sameDispatch(id, from, dispatchedAt).and(FIELD_ATTEMPTS).is(attempts);
        Update update = new Update()
                .inc(FIELD_ATTEMPTS, 1)
                .set(FIELD_DUE_AT, dueAt);
        return updateOne(sameAttempt, update);
    }

    @Override
    public boolean postpone(String id, Set<DeliveryStatus> from, Instant dispatchedAt, Instant dueAt) {
        Update update = new Update().set(FIELD_DUE_AT, dueAt);
        return updateOne(sameDispatch(id, from, dispatchedAt), update);
    }

    @Override
    public boolean postponeAfterError(String id, Set<DeliveryStatus> from, Instant dispatchedAt, Instant dueAt) {
        Update update = new Update()
                .inc(FIELD_ERRORS, 1)
                .set(FIELD_DUE_AT, dueAt);
        return updateOne(sameDispatch(id, from, dispatchedAt), update);
    }

    @Override
    public boolean markAcked(String id, String dispatchId, Set<DeliveryStatus> from, Instant ackedAt, Instant dueAt) {
        Update update = new Update()
                .set(FIELD_STATUS, DeliveryStatus.ACKED)
                .set(FIELD_ACKED_AT, ackedAt)
                .set(FIELD_DUE_AT, dueAt);
        return updateOne(thisDispatch(id, from, dispatchId), update);
    }

    @Override
    public boolean markDone(String id, String dispatchId, Set<DeliveryStatus> from, Instant finishedAt, Instant expiresAt) {
        Update update = closed(DeliveryStatus.DONE, finishedAt, expiresAt);
        return updateOne(thisDispatch(id, from, dispatchId), update);
    }

    @Override
    public boolean markCancelled(String id, Set<DeliveryStatus> from, Instant finishedAt, Instant expiresAt) {
        Update update = closed(DeliveryStatus.CANCELLED, finishedAt, expiresAt);
        return updateOne(stillIn(id, from), update);
    }

    @Override
    public boolean markCancelled(String id, Set<DeliveryStatus> from, Instant dispatchedAt, Instant finishedAt, Instant expiresAt) {
        Update update = closed(DeliveryStatus.CANCELLED, finishedAt, expiresAt);
        return updateOne(sameDispatch(id, from, dispatchedAt), update);
    }

    @Override
    public boolean markFailed(String id, Set<DeliveryStatus> from, Instant dispatchedAt, DeliveryFailure failure, Instant finishedAt, Instant expiresAt) {
        Update update = closed(DeliveryStatus.FAILED, finishedAt, expiresAt)
                .set(FIELD_FAILURE, failure);
        return updateOne(sameDispatch(id, from, dispatchedAt), update);
    }

    @Override
    public boolean markFailed(String id, String dispatchId, Set<DeliveryStatus> from, DeliveryFailure failure, String error, Instant finishedAt, Instant expiresAt) {
        Update update = closed(DeliveryStatus.FAILED, finishedAt, expiresAt)
                .set(FIELD_FAILURE, failure)
                .set(FIELD_ERROR, error);
        return updateOne(thisDispatch(id, from, dispatchId), update);
    }

    private static void setField(Update update, String field, Object value) {
        if (FIELD_ID.equals(field)) {
            return;
        }
        update.set(field, value);
    }

    private static Update closed(DeliveryStatus status, Instant finishedAt, Instant expiresAt) {
        return new Update()
                .set(FIELD_STATUS, status)
                .set(FIELD_FINISHED_AT, finishedAt)
                .set(FIELD_EXPIRES_AT, expiresAt)
                .unset(FIELD_PAYLOAD_JSON);
    }

    private static Criteria stillIn(String id, Set<DeliveryStatus> from) {
        return Criteria.where(FIELD_ID).is(id).and(FIELD_STATUS).in(from);
    }

    private static Criteria sameDispatch(String id, Set<DeliveryStatus> from, Instant dispatchedAt) {
        return stillIn(id, from).and(FIELD_DISPATCHED_AT).is(dispatchedAt);
    }

    private static Criteria thisDispatch(String id, Set<DeliveryStatus> from, String dispatchId) {
        return stillIn(id, from).and(FIELD_DISPATCH_ID).is(dispatchId);
    }

    private boolean updateOne(Criteria criteria, Update update) {
        Query query = new Query(criteria);
        UpdateResult result = mongoTemplate.updateFirst(query, update, MachineDelivery.class);
        return result.getModifiedCount() > 0;
    }
}
