package com.openframe.data.repository.notification.impl;

import com.openframe.data.document.notification.NotificationReadState;
import com.openframe.data.repository.notification.CustomNotificationReadStateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Repository
@RequiredArgsConstructor
public class CustomNotificationReadStateRepositoryImpl implements CustomNotificationReadStateRepository {

    private static final String FIELD_USER_ID = "userId";
    private static final String FIELD_NOTIFICATION_ID = "notificationId";
    private static final String FIELD_READ_AT = "readAt";

    private final MongoTemplate mongoTemplate;

    @Override
    public boolean markRead(String userId, String notificationId) {
        Query query = Query.query(
                Criteria.where(FIELD_USER_ID).is(userId)
                        .and(FIELD_NOTIFICATION_ID).is(notificationId));

        Update update = new Update()
                .setOnInsert(FIELD_USER_ID, userId)
                .setOnInsert(FIELD_NOTIFICATION_ID, notificationId)
                .setOnInsert(FIELD_READ_AT, Instant.now());

        try {
            var result = mongoTemplate.upsert(query, update, NotificationReadState.class);
            return result.getUpsertedId() != null;
        } catch (DuplicateKeyException ex) {
            // Concurrent inserts hitting the unique index — treat as already-read.
            return false;
        }
    }

    @Override
    public Set<String> findReadIds(String userId, Collection<String> notificationIds) {
        if (notificationIds == null || notificationIds.isEmpty()) {
            return Set.of();
        }

        Query query = Query.query(
                Criteria.where(FIELD_USER_ID).is(userId)
                        .and(FIELD_NOTIFICATION_ID).in(notificationIds));
        query.fields().include(FIELD_NOTIFICATION_ID);

        List<NotificationReadState> rows = mongoTemplate.find(query, NotificationReadState.class);
        Set<String> ids = new HashSet<>(rows.size());
        for (NotificationReadState row : rows) {
            ids.add(row.getNotificationId());
        }
        return ids;
    }
}
