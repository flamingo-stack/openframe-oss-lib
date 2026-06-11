package com.openframe.data.repository.notification.impl;

import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.NotificationReadState;
import com.openframe.data.document.notification.ReadStatus;
import com.openframe.data.document.notification.RecipientType;
import com.openframe.data.mongo.TenantAwareMongoTemplate;
import com.openframe.data.repository.notification.CustomNotificationRepository;
import com.openframe.data.repository.notification.NotificationPage;
import com.openframe.data.repository.notification.NotificationWithStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.types.ObjectId;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

import static org.apache.commons.lang3.StringUtils.isBlank;

@Slf4j
@Repository
@RequiredArgsConstructor
public class CustomNotificationRepositoryImpl implements CustomNotificationRepository {

    private static final String FIELD_ID = "_id";
    private static final String FIELD_TITLE = "title";
    private static final String FIELD_RECIPIENT_ID = "recipientId";
    private static final String FIELD_RECIPIENT_TYPE = "recipientType";
    private static final String FIELD_NOTIFICATION_ID = "notificationId";
    private static final String FIELD_STATUS = "status";

    private final TenantAwareMongoTemplate mongoTemplate;

    @Override
    public NotificationPage findPageForRecipient(String recipientId, RecipientType recipientType,
                                                 Boolean readFilter, String search,
                                                 String cursor, boolean backward,
                                                 Sort.Direction direction, int limit) {
        Sort.Direction effective = effectiveDirection(direction, backward);
        LinkedHashMap<String, ReadStatus> idsToStatus = fetchReadStates(
                recipientId, recipientType, readFilter, search, cursor, effective, limit);
        if (idsToStatus.isEmpty()) {
            return NotificationPage.of(List.of());
        }
        return NotificationPage.of(fetchNotificationsPreservingOrder(idsToStatus));
    }

    private LinkedHashMap<String, ReadStatus> fetchReadStates(String recipientId, RecipientType recipientType,
                                                              Boolean readFilter, String search,
                                                              String cursor, Sort.Direction effectiveDirection,
                                                              int limit) {
        Criteria criteria = Criteria.where(FIELD_RECIPIENT_ID).is(recipientId)
                .and(FIELD_RECIPIENT_TYPE).is(recipientType);
        applyStatusFilter(criteria, readFilter);
        applyCursor(criteria, cursor, effectiveDirection);
        applySearch(criteria, search);

        Query query = new Query(criteria);
        query.fields().include(FIELD_NOTIFICATION_ID).include(FIELD_STATUS);
        query.with(Sort.by(effectiveDirection, FIELD_NOTIFICATION_ID));
        query.limit(limit);

        List<NotificationReadState> rows = mongoTemplate.find(query, NotificationReadState.class);
        LinkedHashMap<String, ReadStatus> ordered = new LinkedHashMap<>(rows.size());
        for (NotificationReadState row : rows) {
            ordered.put(row.getNotificationId(), row.getStatus());
        }
        return ordered;
    }

    private static Sort.Direction effectiveDirection(Sort.Direction requested, boolean backward) {
        Sort.Direction safe = requested != null ? requested : Sort.Direction.DESC;
        if (!backward) {
            return safe;
        }
        return safe == Sort.Direction.DESC ? Sort.Direction.ASC : Sort.Direction.DESC;
    }

    private List<NotificationWithStatus> fetchNotificationsPreservingOrder(LinkedHashMap<String, ReadStatus> idsToStatus) {
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
        List<Notification> fetched = mongoTemplate.find(
                new Query(Criteria.where(FIELD_ID).in(objectIds)), Notification.class);

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

    private static void applyCursor(Criteria criteria, String cursor, Sort.Direction effectiveDirection) {
        if (isBlank(cursor)) {
            return;
        }
        if (effectiveDirection == Sort.Direction.DESC) {
            criteria.and(FIELD_NOTIFICATION_ID).lt(cursor);
        } else {
            criteria.and(FIELD_NOTIFICATION_ID).gt(cursor);
        }
    }

    private static void applySearch(Criteria criteria, String search) {
        if (isBlank(search)) {
            return;
        }
        criteria.and(FIELD_TITLE).regex(Pattern.quote(search), "i");
    }
}
