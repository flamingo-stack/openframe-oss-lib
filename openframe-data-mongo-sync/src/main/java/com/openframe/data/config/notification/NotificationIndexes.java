package com.openframe.data.config.notification;

import com.openframe.data.document.notification.BroadcastRecipient;
import com.openframe.data.document.notification.MachineRecipient;
import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.UserRecipient;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.CompoundIndexDefinition;
import org.springframework.data.mongodb.core.index.IndexOperations;
import org.springframework.data.mongodb.core.index.PartialIndexFilter;

import java.util.HashMap;
import java.util.Map;

@Slf4j
public final class NotificationIndexes {

    public static final String USER_INDEX = "recipient_user_id";
    public static final String MACHINE_INDEX = "recipient_machine_id";
    public static final String CLASS_INDEX = "recipient_class_id";

    public static final String USER_CLASS = UserRecipient.class.getName();
    public static final String MACHINE_CLASS = MachineRecipient.class.getName();
    public static final String BROADCAST_CLASS = BroadcastRecipient.class.getName();

    private static final String COLLECTION = "notifications";

    private NotificationIndexes() {
    }

    public static void ensure(MongoTemplate mongoTemplate) {
        IndexOperations ops = mongoTemplate.indexOps(Notification.class);
        Map<String, Document> existing = listIndexes(mongoTemplate);

        ensurePartial(ops, existing, USER_INDEX,
                new Document("recipient.userId", 1).append("_id", -1),
                classFilter(USER_CLASS));

        ensurePartial(ops, existing, MACHINE_INDEX,
                new Document("recipient.machineId", 1).append("_id", -1),
                classFilter(MACHINE_CLASS));

        ensurePartial(ops, existing, CLASS_INDEX,
                new Document("recipient._class", 1).append("_id", -1),
                classFilter(BROADCAST_CLASS));
    }

    private static Map<String, Document> listIndexes(MongoTemplate mongoTemplate) {
        Map<String, Document> result = new HashMap<>();
        for (Document idx : mongoTemplate.getCollection(COLLECTION).listIndexes()) {
            result.put(idx.getString("name"), idx);
        }
        return result;
    }

    private static Document classFilter(String fqcn) {
        return new Document("recipient._class", fqcn);
    }

    private static void ensurePartial(IndexOperations ops,
                                      Map<String, Document> existing,
                                      String name,
                                      Document keys,
                                      Document partialFilter) {
        Document current = existing.get(name);
        if (current != null && partialFilter.equals(current.get("partialFilterExpression"))) {
            return;
        }
        if (current != null) {
            log.info("Dropping existing notifications index '{}' to recreate with partial filter {}",
                    name, partialFilter.toJson());
            ops.dropIndex(name);
        } else {
            log.info("Creating partial notifications index '{}' with filter {}",
                    name, partialFilter.toJson());
        }
        ops.ensureIndex(new CompoundIndexDefinition(keys)
                .named(name)
                .partial(PartialIndexFilter.of(partialFilter)));
    }
}
