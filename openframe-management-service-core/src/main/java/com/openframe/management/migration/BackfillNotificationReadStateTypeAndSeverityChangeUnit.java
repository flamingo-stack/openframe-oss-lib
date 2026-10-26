package com.openframe.management.migration;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoCursor;
import com.mongodb.client.result.UpdateResult;
import com.openframe.data.service.TenantIdProvider;
import io.mongock.api.annotations.ChangeUnit;
import io.mongock.api.annotations.Execution;
import io.mongock.api.annotations.RollbackExecution;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

// Read states created before type and severity were copied onto them cannot be narrowed by either; the
// values still exist on the notification (30-day retention), so each shape is copied over in one updateMany
// per distinct (type, severity) pair. Rows whose notification already expired stay untyped and never match
// a type filter. Rollback is empty on purpose: a copied value is never wrong, only absent.
@Slf4j
@ChangeUnit(id = "backfill-notification-read-state-type-and-severity", order = "020", author = "openframe")
public class BackfillNotificationReadStateTypeAndSeverityChangeUnit {

    static final int BATCH_SIZE = 1000;

    private static final String NOTIFICATIONS = "notifications";
    private static final String READ_STATES = "notification_read_states";
    private static final String TENANT_ID_FIELD = "tenantId";
    private static final String ID_FIELD = "_id";
    private static final String TYPE_FIELD = "type";
    private static final String SEVERITY_FIELD = "severity";
    private static final String NOTIFICATION_ID_FIELD = "notificationId";

    @Execution
    public void execution(MongoTemplate mongoTemplate, TenantIdProvider tenantIdProvider) {
        String tenantId = tenantIdProvider.getTenantId();
        MongoCollection<Document> notifications = mongoTemplate.getCollection(NOTIFICATIONS);
        MongoCollection<Document> readStates = mongoTemplate.getCollection(READ_STATES);

        Map<Document, List<String>> notificationIdsByShape = groupNotificationIdsByShape(notifications, tenantId);
        long modified = 0;
        for (Map.Entry<Document, List<String>> shape : notificationIdsByShape.entrySet()) {
            modified += copyShapeOntoReadStates(readStates, tenantId, shape.getKey(), shape.getValue());
        }
        log.info("Copied type and severity onto {} notification_read_states document(s) of {} shape(s), tenantId={}",
                modified, notificationIdsByShape.size(), tenantId);
    }

    private Map<Document, List<String>> groupNotificationIdsByShape(MongoCollection<Document> notifications,
                                                                    String tenantId) {
        Document tenantFilter = new Document(TENANT_ID_FIELD, tenantId);
        Document shapeOnly = new Document(TYPE_FIELD, 1).append(SEVERITY_FIELD, 1);
        Map<Document, List<String>> idsByShape = new HashMap<>();
        try (MongoCursor<Document> cursor = notifications.find(tenantFilter).projection(shapeOnly).iterator()) {
            while (cursor.hasNext()) {
                Document notification = cursor.next();
                Document shape = shapeOf(notification);
                if (shape.isEmpty()) {
                    continue;
                }
                String notificationId = notification.get(ID_FIELD).toString();
                idsByShape.computeIfAbsent(shape, key -> new ArrayList<>()).add(notificationId);
            }
        }
        return idsByShape;
    }

    private static Document shapeOf(Document notification) {
        Document shape = new Document();
        String type = notification.getString(TYPE_FIELD);
        if (type != null) {
            shape.append(TYPE_FIELD, type);
        }
        String severity = notification.getString(SEVERITY_FIELD);
        if (severity != null) {
            shape.append(SEVERITY_FIELD, severity);
        }
        return shape;
    }

    private long copyShapeOntoReadStates(MongoCollection<Document> readStates, String tenantId,
                                         Document shape, List<String> notificationIds) {
        long modified = 0;
        Document set = new Document("$set", shape);
        for (int from = 0; from < notificationIds.size(); from += BATCH_SIZE) {
            int to = Math.min(from + BATCH_SIZE, notificationIds.size());
            List<String> batch = notificationIds.subList(from, to);
            Document filter = new Document(TENANT_ID_FIELD, tenantId)
                    .append(NOTIFICATION_ID_FIELD, new Document("$in", batch))
                    .append(TYPE_FIELD, new Document("$exists", false));
            UpdateResult result = readStates.updateMany(filter, set);
            modified += result.getModifiedCount();
        }
        return modified;
    }

    @RollbackExecution
    public void rollback() {
    }
}
