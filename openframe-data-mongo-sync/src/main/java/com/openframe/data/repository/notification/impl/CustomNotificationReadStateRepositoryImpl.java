package com.openframe.data.repository.notification.impl;

import com.mongodb.MongoBulkWriteException;
import com.mongodb.client.model.BulkWriteOptions;
import com.mongodb.client.model.InsertOneModel;
import com.mongodb.client.model.WriteModel;
import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.NotificationReadState;
import com.openframe.data.document.notification.ReadStatus;
import com.openframe.data.document.notification.RecipientType;
import com.openframe.data.repository.notification.CustomNotificationReadStateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.*;

@Slf4j
@Repository
@RequiredArgsConstructor
public class CustomNotificationReadStateRepositoryImpl implements CustomNotificationReadStateRepository {

    private static final String COLLECTION = "notification_read_states";
    private static final String FIELD_RECIPIENT_ID = "recipientId";
    private static final String FIELD_RECIPIENT_TYPE = "recipientType";
    private static final String FIELD_NOTIFICATION_ID = "notificationId";
    private static final String FIELD_STATUS = "status";
    private static final String FIELD_CATEGORY = "category";
    private static final String FIELD_READ_AT = "readAt";

    private final MongoTemplate mongoTemplate;

    @Override
    public void createForAudience(String notificationId, NotificationCategory category,
                                  RecipientType recipientType, Collection<String> recipientIds) {
        if (recipientIds == null || recipientIds.isEmpty()) {
            return;
        }
        NotificationCategory effectiveCategory = category == null ? NotificationCategory.GENERIC : category;
        List<WriteModel<Document>> writes = new ArrayList<>(recipientIds.size());
        for (String recipientId : recipientIds) {
            Document doc = new Document()
                    .append(FIELD_RECIPIENT_ID, recipientId)
                    .append(FIELD_RECIPIENT_TYPE, recipientType.name())
                    .append(FIELD_NOTIFICATION_ID, notificationId)
                    .append(FIELD_STATUS, ReadStatus.UNREAD.name())
                    .append(FIELD_CATEGORY, effectiveCategory.name());
            writes.add(new InsertOneModel<>(doc));
        }
        try {
            mongoTemplate.getCollection(COLLECTION).bulkWrite(writes, new BulkWriteOptions().ordered(false));
        } catch (MongoBulkWriteException ex) {
            if (!allDuplicateKeyErrors(ex)) {
                throw ex;
            }
            log.debug("createForAudience duplicate-key on retry for notificationId={} ({} errors)",
                    notificationId, ex.getWriteErrors().size());
        }
    }

    private static boolean allDuplicateKeyErrors(MongoBulkWriteException ex) {
        if (ex.getWriteErrors().isEmpty()) {
            return false;
        }
        return ex.getWriteErrors().stream().allMatch(err -> err.getCode() == 11000);
    }

    @Override
    public boolean markRead(String recipientId, RecipientType recipientType, String notificationId) {
        Query query = Query.query(forRecipient(recipientId, recipientType)
                .and(FIELD_NOTIFICATION_ID).is(notificationId)
                .and(FIELD_STATUS).is(ReadStatus.UNREAD));
        Update update = new Update()
                .set(FIELD_STATUS, ReadStatus.READ)
                .set(FIELD_READ_AT, Instant.now());
        return mongoTemplate.updateFirst(query, update, NotificationReadState.class).getModifiedCount() > 0;
    }

    @Override
    public long markAllAsRead(String recipientId, RecipientType recipientType) {
        Query query = Query.query(forRecipient(recipientId, recipientType)
                .and(FIELD_STATUS).is(ReadStatus.UNREAD));
        Update update = new Update()
                .set(FIELD_STATUS, ReadStatus.READ)
                .set(FIELD_READ_AT, Instant.now());
        return mongoTemplate.updateMulti(query, update, NotificationReadState.class).getModifiedCount();
    }

    @Override
    public boolean softDelete(String recipientId, RecipientType recipientType, String notificationId) {
        Query query = Query.query(forRecipient(recipientId, recipientType)
                .and(FIELD_NOTIFICATION_ID).is(notificationId)
                .and(FIELD_STATUS).ne(ReadStatus.DELETED));
        Update update = new Update().set(FIELD_STATUS, ReadStatus.DELETED);
        return mongoTemplate.updateFirst(query, update, NotificationReadState.class).getModifiedCount() > 0;
    }

    @Override
    public long softDeleteAllRead(String recipientId, RecipientType recipientType) {
        Query query = Query.query(forRecipient(recipientId, recipientType)
                .and(FIELD_STATUS).is(ReadStatus.READ));
        Update update = new Update().set(FIELD_STATUS, ReadStatus.DELETED);
        return mongoTemplate.updateMulti(query, update, NotificationReadState.class).getModifiedCount();
    }

    @Override
    public boolean hasUnread(String recipientId, RecipientType recipientType) {
        Query query = Query.query(forRecipient(recipientId, recipientType)
                .and(FIELD_STATUS).is(ReadStatus.UNREAD));
        return mongoTemplate.exists(query, NotificationReadState.class);
    }

    @Override
    public Map<NotificationCategory, Long> unreadCountsByCategory(String recipientId, RecipientType recipientType) {
        Aggregation agg = Aggregation.newAggregation(
                Aggregation.match(forRecipient(recipientId, recipientType)
                        .and(FIELD_STATUS).is(ReadStatus.UNREAD)),
                Aggregation.group(FIELD_CATEGORY).count().as("count"));
        AggregationResults<Document> results = mongoTemplate.aggregate(
                agg, COLLECTION, Document.class);
        Map<NotificationCategory, Long> counts = new EnumMap<>(NotificationCategory.class);
        for (Document doc : results.getMappedResults()) {
            Object key = doc.get("_id");
            if (key == null) {
                continue;
            }
            counts.put(NotificationCategory.valueOf(key.toString()), ((Number) doc.get("count")).longValue());
        }
        return counts;
    }

    private static Criteria forRecipient(String recipientId, RecipientType recipientType) {
        return Criteria.where(FIELD_RECIPIENT_ID).is(recipientId)
                .and(FIELD_RECIPIENT_TYPE).is(recipientType);
    }
}
