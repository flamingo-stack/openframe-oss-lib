package com.openframe.data.repository.notification.impl;

import com.openframe.data.document.clientconfiguration.PublishState;
import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.RecipientScope;
import com.openframe.data.repository.notification.CustomNotificationRepository;
import lombok.RequiredArgsConstructor;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
@RequiredArgsConstructor
public class CustomNotificationRepositoryImpl implements CustomNotificationRepository {

    private static final String FIELD_ID = "_id";
    private static final String FIELD_RECIPIENT_USER = "recipientUserId";
    private static final String FIELD_RECIPIENT_MACHINE = "recipientMachineId";
    private static final String FIELD_SCOPE = "recipientScope";
    private static final String FIELD_PUBLISH_STATE = "publishState";
    private static final String FIELD_PUBLISHED = "publishState.published";
    private static final String FIELD_ATTEMPTS = "publishState.attempts";

    private final MongoTemplate mongoTemplate;

    @Override
    public List<Notification> findPageForUser(String userId, String cursor, boolean backward, int limit) {
        // Pre-existing rows without a scope field deserialise as USER, so we
        // match recipientUserId unconditionally and only consult scope for the
        // broadcast branch.
        Criteria audience = new Criteria().orOperator(
                Criteria.where(FIELD_RECIPIENT_USER).is(userId),
                Criteria.where(FIELD_SCOPE).is(RecipientScope.ALL));
        return findPage(audience, cursor, backward, limit);
    }

    @Override
    public List<Notification> findPageForMachine(String machineId, String cursor, boolean backward, int limit) {
        Criteria audience = new Criteria().orOperator(
                Criteria.where(FIELD_RECIPIENT_MACHINE).is(machineId),
                Criteria.where(FIELD_SCOPE).is(RecipientScope.ALL));
        return findPage(audience, cursor, backward, limit);
    }

    private List<Notification> findPage(Criteria audience, String cursor, boolean backward, int limit) {
        Query query = new Query(audience);

        if (cursor != null && !cursor.isBlank()) {
            ObjectId cursorId;
            try {
                cursorId = new ObjectId(cursor);
            } catch (IllegalArgumentException ex) {
                throw new IllegalArgumentException("Invalid notification cursor: " + cursor, ex);
            }
            query.addCriteria(backward
                    ? Criteria.where(FIELD_ID).gt(cursorId)
                    : Criteria.where(FIELD_ID).lt(cursorId));
        }

        query.with(Sort.by(backward ? Sort.Direction.ASC : Sort.Direction.DESC, FIELD_ID));
        query.limit(limit);

        return mongoTemplate.find(query, Notification.class);
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
        Criteria audience = new Criteria().orOperator(
                Criteria.where(FIELD_RECIPIENT_USER).is(userId),
                Criteria.where(FIELD_SCOPE).is(RecipientScope.ALL));
        Query query = new Query(audience);
        query.fields().include(FIELD_ID);
        query.with(Sort.by(Sort.Direction.DESC, FIELD_ID));
        query.limit(limit);

        // Project as raw Document so the driver returns only _id without deserialising full notifications.
        List<Document> rows = mongoTemplate.find(query, Document.class, "notifications");
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
