package com.openframe.data.repository.notification.impl;

import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.NotificationReadState;
import com.openframe.data.document.notification.ReadStatus;
import com.openframe.data.document.notification.RecipientType;
import com.openframe.data.repository.notification.CustomNotificationRepository;
import com.openframe.data.repository.notification.NotificationWithStatus;
import lombok.RequiredArgsConstructor;
import org.bson.types.ObjectId;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;

import java.util.*;
import java.util.regex.Pattern;

import static org.apache.commons.lang3.StringUtils.isBlank;

@Repository
@RequiredArgsConstructor
public class CustomNotificationRepositoryImpl implements CustomNotificationRepository {

    private static final String FIELD_ID = "_id";
    private static final String FIELD_TITLE = "title";
    private static final String FIELD_RECIPIENT_ID = "recipientId";
    private static final String FIELD_RECIPIENT_TYPE = "recipientType";
    private static final String FIELD_NOTIFICATION_ID = "notificationId";
    private static final String FIELD_STATUS = "status";

    private static final int SEARCH_MIN_BATCH = 64;
    private static final int SEARCH_BATCH_MULTIPLIER = 4;
    private static final int SEARCH_MAX_ITERATIONS = 10;

    private final MongoTemplate mongoTemplate;

    @Override
    public List<NotificationWithStatus> findPageForRecipient(String recipientId, RecipientType recipientType,
                                                             Boolean readFilter, String search,
                                                             String cursor, boolean backward, int limit) {
        if (isBlank(search)) {
            return findPageNoSearch(recipientId, recipientType, readFilter, cursor, backward, limit);
        }
        return findPageStreamingSearch(recipientId, recipientType, readFilter, search, cursor, backward, limit);
    }

    private List<NotificationWithStatus> findPageNoSearch(String recipientId, RecipientType recipientType,
                                                          Boolean readFilter, String cursor,
                                                          boolean backward, int limit) {
        LinkedHashMap<String, ReadStatus> idsToStatus = fetchReadStatesBatch(
                recipientId, recipientType, readFilter, cursor, backward, limit);
        if (idsToStatus.isEmpty()) {
            return List.of();
        }
        return fetchNotificationsPreservingOrder(idsToStatus, null);
    }

    private List<NotificationWithStatus> findPageStreamingSearch(String recipientId, RecipientType recipientType,
                                                                 Boolean readFilter, String search,
                                                                 String cursor, boolean backward, int limit) {
        List<NotificationWithStatus> collected = new ArrayList<>(limit);
        String iterCursor = cursor;
        int batchSize = Math.max(limit * SEARCH_BATCH_MULTIPLIER, SEARCH_MIN_BATCH);
        for (int iter = 0; iter < SEARCH_MAX_ITERATIONS && collected.size() < limit; iter++) {
            LinkedHashMap<String, ReadStatus> batch = fetchReadStatesBatch(
                    recipientId, recipientType, readFilter, iterCursor, backward, batchSize);
            if (batch.isEmpty()) {
                break;
            }
            List<NotificationWithStatus> matched = fetchNotificationsPreservingOrder(batch, search);
            for (NotificationWithStatus row : matched) {
                collected.add(row);
                if (collected.size() >= limit) {
                    break;
                }
            }
            if (batch.size() < batchSize) {
                break;
            }
            String last = lastKey(batch);
            if (last == null || last.equals(iterCursor)) {
                break;
            }
            iterCursor = last;
        }
        return collected;
    }

    private LinkedHashMap<String, ReadStatus> fetchReadStatesBatch(String recipientId, RecipientType recipientType,
                                                                   Boolean readFilter, String cursor,
                                                                   boolean backward, int batchSize) {
        Criteria criteria = Criteria.where(FIELD_RECIPIENT_ID).is(recipientId)
                .and(FIELD_RECIPIENT_TYPE).is(recipientType);
        applyStatusFilter(criteria, readFilter);
        applyCursor(criteria, cursor, backward);

        Query query = new Query(criteria);
        query.fields().include(FIELD_NOTIFICATION_ID).include(FIELD_STATUS);
        query.with(Sort.by(backward ? Sort.Direction.ASC : Sort.Direction.DESC, FIELD_NOTIFICATION_ID));
        query.limit(batchSize);

        List<NotificationReadState> rows = mongoTemplate.find(query, NotificationReadState.class);
        LinkedHashMap<String, ReadStatus> ordered = new LinkedHashMap<>(rows.size());
        for (NotificationReadState row : rows) {
            ordered.put(row.getNotificationId(), row.getStatus());
        }
        return ordered;
    }

    private List<NotificationWithStatus> fetchNotificationsPreservingOrder(
            LinkedHashMap<String, ReadStatus> idsToStatus, String search) {
        List<ObjectId> objectIds = new ArrayList<>(idsToStatus.size());
        for (String id : idsToStatus.keySet()) {
            try {
                objectIds.add(new ObjectId(id));
            } catch (IllegalArgumentException ignored) {
            }
        }
        if (objectIds.isEmpty()) {
            return List.of();
        }
        Criteria criteria = Criteria.where(FIELD_ID).in(objectIds);
        Criteria searchCriteria = searchCriteria(search);
        if (searchCriteria != null) {
            criteria = new Criteria().andOperator(criteria, searchCriteria);
        }
        List<Notification> fetched = mongoTemplate.find(new Query(criteria), Notification.class);

        Map<String, Notification> byId = new HashMap<>(fetched.size());
        for (Notification n : fetched) {
            byId.put(n.getId(), n);
        }
        List<NotificationWithStatus> ordered = new ArrayList<>(idsToStatus.size());
        for (Map.Entry<String, ReadStatus> entry : idsToStatus.entrySet()) {
            Notification n = byId.get(entry.getKey());
            if (n != null) {
                ordered.add(new NotificationWithStatus(n, entry.getValue()));
            }
        }
        return ordered;
    }

    private static void applyStatusFilter(Criteria criteria, Boolean readFilter) {
        if (readFilter == null) {
            criteria.and(FIELD_STATUS).ne(ReadStatus.DELETED);
        } else if (readFilter) {
            criteria.and(FIELD_STATUS).is(ReadStatus.READ);
        } else {
            criteria.and(FIELD_STATUS).is(ReadStatus.UNREAD);
        }
    }

    private static void applyCursor(Criteria criteria, String cursor, boolean backward) {
        if (isBlank(cursor)) {
            return;
        }
        if (backward) {
            criteria.and(FIELD_NOTIFICATION_ID).gt(cursor);
        } else {
            criteria.and(FIELD_NOTIFICATION_ID).lt(cursor);
        }
    }

    private static Criteria searchCriteria(String search) {
        if (isBlank(search)) {
            return null;
        }
        return Criteria.where(FIELD_TITLE).regex(Pattern.quote(search), "i");
    }

    private static String lastKey(LinkedHashMap<String, ReadStatus> map) {
        String last = null;
        for (String key : map.keySet()) {
            last = key;
        }
        return last;
    }
}
