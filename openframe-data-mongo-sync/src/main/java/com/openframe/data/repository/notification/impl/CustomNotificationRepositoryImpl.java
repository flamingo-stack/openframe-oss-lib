package com.openframe.data.repository.notification.impl;

import com.openframe.data.document.clientconfiguration.PublishState;
import com.openframe.data.document.notification.BroadcastRecipient;
import com.openframe.data.document.notification.Notification;
import com.openframe.data.repository.notification.CustomNotificationRepository;
import lombok.RequiredArgsConstructor;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationOperation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.List;

import static org.apache.commons.lang3.StringUtils.isBlank;

@Repository
@RequiredArgsConstructor
public class CustomNotificationRepositoryImpl implements CustomNotificationRepository {

    private static final String FIELD_ID = "_id";
    private static final String FIELD_RECIPIENT_USER_ID = "recipient.userId";
    private static final String FIELD_RECIPIENT_MACHINE_ID = "recipient.machineId";
    private static final String FIELD_RECIPIENT_CLASS = "recipient._class";
    private static final String BROADCAST_CLASS = BroadcastRecipient.class.getName();
    private static final String FIELD_PUBLISH_STATE = "publishState";
    private static final String FIELD_PUBLISHED = "publishState.published";
    private static final String FIELD_ATTEMPTS = "publishState.attempts";
    private static final String READ_STATE_COLLECTION = "notification_read_states";
    private static final String NOTIFICATIONS_COLLECTION = "notifications";
    private static final String LOOKUP_FIELD = "rs";

    private final MongoTemplate mongoTemplate;

    @Override
    public List<Notification> findPageForUser(String userId, String cursor, boolean backward, int limit) {
        return findPageForUser(userId, null, cursor, backward, limit);
    }

    @Override
    public List<Notification> findPageForUser(String userId, Boolean readFilter, String cursor, boolean backward, int limit) {
        if (readFilter == null) {
            return findPage(userAudience(userId), cursor, backward, limit);
        }
        return findUserPageWithReadFilter(userId, readFilter, cursor, backward, limit);
    }

    @Override
    public List<Notification> findPageForMachine(String machineId, String cursor, boolean backward, int limit) {
        Criteria audience = new Criteria().orOperator(
                Criteria.where(FIELD_RECIPIENT_MACHINE_ID).is(machineId),
                Criteria.where(FIELD_RECIPIENT_CLASS).is(BROADCAST_CLASS));
        return findPage(audience, cursor, backward, limit);
    }

    private static Criteria userAudience(String userId) {
        return new Criteria().orOperator(
                Criteria.where(FIELD_RECIPIENT_USER_ID).is(userId),
                Criteria.where(FIELD_RECIPIENT_CLASS).is(BROADCAST_CLASS));
    }

    private List<Notification> findPage(Criteria audience, String cursor, boolean backward, int limit) {
        Query query = new Query(audience);

        applyCursor(query, cursor, backward);
        query.with(Sort.by(backward ? Sort.Direction.ASC : Sort.Direction.DESC, FIELD_ID));
        query.limit(limit);

        return mongoTemplate.find(query, Notification.class);
    }

    private static void applyCursor(Query query, String cursor, boolean backward) {
        ObjectId cursorId = parseCursor(cursor);
        if (cursorId == null) {
            return;
        }
        query.addCriteria(cursorCriteria(cursorId, backward));
    }

    private static Criteria cursorCriteria(ObjectId cursorId, boolean backward) {
        return backward
                ? Criteria.where(FIELD_ID).gt(cursorId)
                : Criteria.where(FIELD_ID).lt(cursorId);
    }

    private List<Notification> findUserPageWithReadFilter(String userId, boolean read, String cursor, boolean backward, int limit) {
        Criteria audience = userAudience(userId);

        ObjectId cursorId = parseCursor(cursor);
        if (cursorId != null) {
            audience = new Criteria().andOperator(audience, cursorCriteria(cursorId, backward));
        }

        List<AggregationOperation> ops = new ArrayList<>();
        ops.add(Aggregation.match(audience));
        ops.add(Aggregation.sort(backward ? Sort.Direction.ASC : Sort.Direction.DESC, FIELD_ID));
        ops.add(context -> new Document("$lookup", new Document()
                .append("from", READ_STATE_COLLECTION)
                .append("let", new Document("nid", new Document("$toString", "$_id")))
                .append("pipeline", List.of(
                        new Document("$match", new Document("$expr", new Document("$and", List.of(
                                new Document("$eq", List.of("$userId", userId)),
                                new Document("$eq", List.of("$notificationId", "$$nid"))
                        )))),
                        new Document("$project", new Document("_id", 1)),
                        new Document("$limit", 1)))
                .append("as", LOOKUP_FIELD)));
        ops.add(Aggregation.match(read
                ? Criteria.where(LOOKUP_FIELD).not().size(0)
                : Criteria.where(LOOKUP_FIELD).size(0)));
        ops.add(Aggregation.limit(limit));

        AggregationResults<Notification> results = mongoTemplate.aggregate(
                Aggregation.newAggregation(ops), NOTIFICATIONS_COLLECTION, Notification.class);
        return results.getMappedResults();
    }

    private static ObjectId parseCursor(String cursor) {
        if (isBlank(cursor)) {
            return null;
        }
        try {
            return new ObjectId(cursor);
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Invalid notification cursor: " + cursor, ex);
        }
    }

    @Override
    public void updatePublishState(String id, PublishState publishState) {
        mongoTemplate.updateFirst(
                Query.query(Criteria.where(FIELD_ID).is(new ObjectId(id))),
                new Update().set(FIELD_PUBLISH_STATE, publishState),
                Notification.class);
    }

    @Override
    public List<String> findRecentIdsForUser(String userId, int limit) {
        Query query = new Query(userAudience(userId));
        query.fields().include(FIELD_ID);
        query.with(Sort.by(Sort.Direction.DESC, FIELD_ID));
        query.limit(limit);

        List<Document> rows = mongoTemplate.find(query, Document.class, NOTIFICATIONS_COLLECTION);
        return rows.stream()
                .map(row -> row.getObjectId(FIELD_ID).toHexString())
                .toList();
    }

    @Override
    public List<Notification> findRetryablePublishCandidates(int maxAttempts, int limit) {
        Query query = new Query(Criteria.where(FIELD_PUBLISHED).is(false)
                .and(FIELD_ATTEMPTS).lt(maxAttempts));
        query.with(Sort.by(Sort.Direction.ASC, FIELD_ID));
        query.limit(limit);

        return mongoTemplate.find(query, Notification.class);
    }
}
