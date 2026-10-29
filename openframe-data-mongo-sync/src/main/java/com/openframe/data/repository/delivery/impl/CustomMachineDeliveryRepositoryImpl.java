package com.openframe.data.repository.delivery.impl;

import com.mongodb.ReadPreference;
import com.mongodb.client.result.UpdateResult;
import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryStatus;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.mongo.TenantAwareMongoTemplate;
import com.openframe.data.repository.TenantAwareRepositorySupport;
import com.openframe.data.repository.delivery.CustomMachineDeliveryRepository;
import com.openframe.data.repository.delivery.RerunPublication;
import org.bson.Document;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@ConditionalOnProperty(name = "openframe.tenant-isolation.enabled", havingValue = "true")
public class CustomMachineDeliveryRepositoryImpl extends TenantAwareRepositorySupport
        implements CustomMachineDeliveryRepository {

    private static final String FIELD_ID = "_id";
    private static final String FIELD_TENANT_ID = "tenantId";
    private static final String FIELD_STATUS = "status";
    private static final String FIELD_TYPE = "type";
    private static final String FIELD_ATTEMPTS = "attempts";
    private static final String FIELD_ERRORS = "errors";
    private static final String FIELD_RERUNS = "reruns";
    private static final String FIELD_DISPATCH_ID = "dispatchId";
    private static final String FIELD_SEQUENCE = "sequence";
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

    @Override
    public List<MachineDelivery> findDue(DeliveryStatus status, Instant before, int limit) {
        Criteria due = Criteria.where(FIELD_STATUS).is(status).and(FIELD_DUE_AT).lt(before);
        return findDue(due, limit);
    }

    @Override
    public List<MachineDelivery> findDue(DeliveryStatus status, Set<DeliveryType> types, Instant before, int limit) {
        Criteria due = Criteria.where(FIELD_STATUS).is(status).and(FIELD_TYPE).in(types).and(FIELD_DUE_AT).lt(before);
        return findDue(due, limit);
    }

    @Override
    public List<MachineDelivery> findDueExcept(DeliveryStatus status, Set<DeliveryType> types, Instant before, int limit) {
        Criteria due = Criteria.where(FIELD_STATUS).is(status).and(FIELD_TYPE).nin(types).and(FIELD_DUE_AT).lt(before);
        return findDue(due, limit);
    }

    // primary on purpose: a receiver that reports by key does so milliseconds after the row was written
    @Override
    public Optional<MachineDelivery> findByIdOnPrimary(String id) {
        Query query = new Query(Criteria.where(FIELD_ID).is(id)).withReadPreference(ReadPreference.primary());
        MachineDelivery row = mongoTemplate.findOne(query, MachineDelivery.class);
        return Optional.ofNullable(row);
    }

    // primary on purpose: a lagging secondary shows a row the sweep already re-sent as still due
    private List<MachineDelivery> findDue(Criteria due, int limit) {
        Query query = new Query(due)
                .with(OLDEST_DUE_FIRST)
                .limit(limit)
                .withReadPreference(ReadPreference.primary());
        return mongoTemplate.find(query, MachineDelivery.class);
    }

    // $set per field, not a replacement document: a replacement is inserted without the tenant of the scoped filter;
    // null fields are not written, so what a previous dispatch closed the row with has to be unset explicitly.
    // false = a newer dispatch of the same key holds the row: a rollout reaching a machine after a force leaves it alone
    @Override
    public boolean upsertPending(MachineDelivery delivery) {
        Document document = new Document();
        mongoTemplate.getConverter().write(delivery, document);
        Update update = new Update().set(FIELD_TENANT_ID, tenantId())
                .unset(FIELD_ACKED_AT)
                .unset(FIELD_FINISHED_AT)
                .unset(FIELD_FAILURE)
                .unset(FIELD_ERROR);
        document.forEach((field, value) -> setField(update, field, value));
        Query notOutranked = notOutranked(delivery);
        try {
            mongoTemplate.upsert(notOutranked, update, MachineDelivery.class);
            return true;
        } catch (DuplicateKeyException rowExists) {
            // the filter missed an existing row: a newer decision holds it, or another pod inserted it a moment ago
            UpdateResult result = mongoTemplate.updateFirst(notOutranked, update, MachineDelivery.class);
            return result.getMatchedCount() > 0;
        }
    }

    private static Query notOutranked(MachineDelivery delivery) {
        String id = delivery.getId();
        int sequence = delivery.getSequence();
        Criteria noSequenceYet = Criteria.where(FIELD_SEQUENCE).exists(false);
        Criteria older = Criteria.where(FIELD_SEQUENCE).lt(sequence);
        Criteria notOutranked = Criteria.where(FIELD_ID).is(id).orOperator(noSequenceYet, older);
        return new Query(notOutranked);
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
        Criteria agentHadIt = publishedDispatch(id, from, dispatchId);
        return updateOne(agentHadIt, update);
    }

    // back to PENDING for a later run; the dispatchId stays until that run is published, so a late DONE still closes the row
    @Override
    public boolean scheduleRerun(String id, Set<DeliveryStatus> from, Instant dispatchedAt, int reruns, Instant dueAt) {
        Criteria thisRun = sameDispatch(id, from, dispatchedAt).andOperator(runNumber(reruns));
        Update update = rerun(dueAt);
        return updateOne(thisRun, update);
    }

    @Override
    public boolean scheduleRerun(String id, String dispatchId, Set<DeliveryStatus> from, int reruns, Instant dueAt) {
        Criteria thisRun = publishedDispatch(id, from, dispatchId).andOperator(runNumber(reruns));
        Update update = rerun(dueAt);
        return updateOne(thisRun, update);
    }

    // the first publish of a re-run: a new dispatch of the same row, counted as its first attempt
    @Override
    public boolean markRerunPublished(RerunPublication publication) {
        String id = publication.getId();
        Set<DeliveryStatus> from = publication.getFrom();
        Instant dispatchedAt = publication.getDispatchedAt();
        Criteria notYetPublished = sameDispatch(id, from, dispatchedAt).and(FIELD_ATTEMPTS).is(0);
        Update update = new Update()
                .set(FIELD_DISPATCH_ID, publication.getDispatchId())
                .set(FIELD_DISPATCHED_AT, publication.getPublishedAt())
                .set(FIELD_PAYLOAD_JSON, publication.getPayloadJson())
                .set(FIELD_ATTEMPTS, 1)
                .set(FIELD_DUE_AT, publication.getDueAt());
        return updateOne(notYetPublished, update);
    }

    private static Update rerun(Instant dueAt) {
        return new Update()
                .set(FIELD_STATUS, DeliveryStatus.PENDING)
                .set(FIELD_ATTEMPTS, 0)
                .set(FIELD_ERRORS, 0)
                .inc(FIELD_RERUNS, 1)
                .set(FIELD_DUE_AT, dueAt)
                .unset(FIELD_ACKED_AT)
                .unset(FIELD_FINISHED_AT)
                .unset(FIELD_FAILURE)
                .unset(FIELD_ERROR);
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

    // a dispatch the agent can report on: not a re-run that is scheduled and waits for its publish under the old dispatchId
    private static Criteria publishedDispatch(String id, Set<DeliveryStatus> from, String dispatchId) {
        Criteria firstRun = Criteria.where(FIELD_RERUNS).not().gt(0);
        Criteria published = Criteria.where(FIELD_ATTEMPTS).gt(0);
        return thisDispatch(id, from, dispatchId).orOperator(firstRun, published);
    }

    // the run the caller read; a second closer of the same run finds the count moved on and matches nothing
    private static Criteria runNumber(int reruns) {
        if (reruns == 0) {
            return Criteria.where(FIELD_RERUNS).not().gt(0);
        }
        return Criteria.where(FIELD_RERUNS).is(reruns);
    }

    private boolean updateOne(Criteria criteria, Update update) {
        Query query = new Query(criteria);
        UpdateResult result = mongoTemplate.updateFirst(query, update, MachineDelivery.class);
        return result.getModifiedCount() > 0;
    }
}
