package com.openframe.data.integration.performance;

import com.mongodb.client.MongoCollection;
import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.NotificationReadState;
import com.openframe.data.document.notification.ReadStatus;
import com.openframe.data.document.notification.RecipientType;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.IntegrationTestApplication;
import com.openframe.data.integration.support.MongoExplain;
import com.openframe.data.integration.support.MongoExplain.Stats;
import com.openframe.data.integration.support.PerfResultRecorder;
import com.openframe.data.repository.notification.NotificationReadStateRepository;
import com.openframe.data.repository.notification.NotificationRepository;
import com.openframe.data.repository.notification.NotificationWithStatus;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.MongoPersistentEntityIndexResolver;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.io.IOException;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@Slf4j
@SpringBootTest(classes = IntegrationTestApplication.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@Tag("performance")
@EnabledIfSystemProperty(named = "performance.tests", matches = "true")
class NotificationReadStateIndexUsageIT extends BaseMongoIntegrationTest {

    private static final int NOTIF_TOTAL        = Integer.getInteger("perf.notifications.count", 30_000);
    private static final int HOT_ADMIN_NOTIFS   = Integer.getInteger("perf.readStates.hotAdmin", 3_000);
    private static final int HOT_MACHINE_NOTIFS = Integer.getInteger("perf.readStates.hotMachine", 1_000);
    private static final int NOISE_READ_STATES  = Integer.getInteger("perf.readStates.noise", 20_000);

    private static final int BATCH_FLUSH_SIZE = 2_000;

    private static final String HOT_ADMIN   = "admin-hot";
    private static final String HOT_MACHINE = "machine-hot";

    private static final String NOTIFS_COLL = "notifications";
    private static final String READS_COLL  = "notification_read_states";

    private static final String IDX_RECIPIENT_NOTIF   = "recipient_notification_unique";
    private static final String IDX_RECIPIENT_STATUS  = "recipient_status";
    private static final String IDX_RECIPIENT_CAT_ST  = "recipient_category_status";

    private static final String FIELD_RECIPIENT_ID    = "recipientId";
    private static final String FIELD_RECIPIENT_TYPE  = "recipientType";
    private static final String FIELD_NOTIFICATION_ID = "notificationId";
    private static final String FIELD_STATUS          = "status";
    private static final String FIELD_CATEGORY        = "category";

    private static final long FIND_BUDGET_MS  = 200;
    private static final long WRITE_BUDGET_MS = 100;

    private static final Path REPORT_DIR = Path.of("target", "perf-results");

    @Autowired
    private MongoTemplate mongoTemplate;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private NotificationReadStateRepository readStateRepository;

    private final List<String> hotAdminNotifIds = new ArrayList<>();
    private final List<String> hotMachineNotifIds = new ArrayList<>();
    private final PerfResultRecorder recorder = new PerfResultRecorder(getClass().getSimpleName());

    @BeforeAll
    void seed() {
        mongoTemplate.dropCollection(Notification.class);
        mongoTemplate.dropCollection(NotificationReadState.class);
        ensureIndexes(Notification.class);
        ensureIndexes(NotificationReadState.class);
        seedNotifications();
        seedReadStates();
    }

    @AfterAll
    void writeReports() throws IOException {
        recorder.writeMarkdown(REPORT_DIR);
    }

    private void ensureIndexes(Class<?> entityClass) {
        var indexOps = mongoTemplate.indexOps(entityClass);
        new MongoPersistentEntityIndexResolver(mongoTemplate.getConverter().getMappingContext())
                .resolveIndexFor(entityClass)
                .forEach(indexOps::ensureIndex);
    }

    @Test
    @DisplayName("Given a heavily seeded read_states collection, when findPageForRecipient step 1 (read_states scan + sort by notificationId desc + limit) runs, then it uses an indexed plan covering both the filter and the sort — Mongo's optimizer prefers recipient_notification_unique (sort served by reverse index walk) but recipient_status is also valid")
    void list_for_recipient_step_one_uses_indexed_plan() {
        int limit = 25;

        List<NotificationWithStatus> page = notificationRepository.findPageForRecipient(
                HOT_ADMIN, RecipientType.USER, null, null, null, false, limit).items();
        assertThat(page).hasSize(limit);

        Stats stats = MongoExplain.explainFind(mongoTemplate, READS_COLL, readStateAudienceQuery(HOT_ADMIN, RecipientType.USER, limit));

        stats.assertNoCollectionScan()
                .assertUsesAnyOf(IDX_RECIPIENT_NOTIF, IDX_RECIPIENT_STATUS)
                .assertExecutionTimeBelow(FIND_BUDGET_MS);
        stats.assertExaminedAtMost(limit * 4L);

        recorder.record("findPageForRecipient step1 — admin USER audience, limit 25",
                "returned", page.size(),
                "executionTimeMs", stats.executionTimeMillis(),
                "keysExamined", stats.keysExamined(),
                "indexes", stats.indexesUsed());
    }

    @Test
    @DisplayName("Given a heavily seeded read_states collection, when findPageForRecipient runs for MACHINE recipientType, then it uses an indexed plan and stays within page-size key budget — recipientType disambiguates id namespace")
    void list_for_recipient_machine_uses_indexed_plan() {
        int limit = 25;

        List<NotificationWithStatus> page = notificationRepository.findPageForRecipient(
                HOT_MACHINE, RecipientType.MACHINE, null, null, null, false, limit).items();
        assertThat(page).hasSize(limit);

        Stats stats = MongoExplain.explainFind(mongoTemplate, READS_COLL, readStateAudienceQuery(HOT_MACHINE, RecipientType.MACHINE, limit));

        stats.assertNoCollectionScan()
                .assertUsesAnyOf(IDX_RECIPIENT_NOTIF, IDX_RECIPIENT_STATUS)
                .assertExecutionTimeBelow(FIND_BUDGET_MS);
        stats.assertExaminedAtMost(limit * 4L);
    }

    @Test
    @DisplayName("Given a heavily seeded read_states collection, when hasUnread runs (exists check on recipient + status=UNREAD), then it hits recipient_status and short-circuits — examines at most one key")
    void has_unread_uses_recipient_status_index() {
        boolean unread = readStateRepository.existsByRecipientIdAndRecipientTypeAndStatus(
                HOT_ADMIN, RecipientType.USER, ReadStatus.UNREAD);
        assertThat(unread).isTrue();

        Query q = Query.query(Criteria.where(FIELD_RECIPIENT_ID).is(HOT_ADMIN)
                .and(FIELD_RECIPIENT_TYPE).is(RecipientType.USER)
                .and(FIELD_STATUS).is(ReadStatus.UNREAD));
        q.limit(1);

        Stats stats = MongoExplain.explainFind(mongoTemplate, READS_COLL, q);

        stats.assertNoCollectionScan()
                .assertUsesIndex(IDX_RECIPIENT_STATUS)
                .assertExecutionTimeBelow(FIND_BUDGET_MS);
        stats.assertExaminedAtMost(2);
    }

    @Test
    @DisplayName("Given a heavily seeded read_states collection, when markRead query runs (single row match by recipient + notificationId + status=UNREAD), then it hits recipient_notification_unique — single-key lookup")
    void mark_read_uses_unique_compound_index() {
        String probeNotifId = hotAdminNotifIds.get(0);

        Query query = Query.query(
                Criteria.where(FIELD_RECIPIENT_ID).is(HOT_ADMIN)
                        .and(FIELD_RECIPIENT_TYPE).is(RecipientType.USER)
                        .and(FIELD_NOTIFICATION_ID).is(probeNotifId)
                        .and(FIELD_STATUS).is(ReadStatus.UNREAD));

        Stats stats = MongoExplain.explainFind(mongoTemplate, READS_COLL, query);

        stats.assertNoCollectionScan()
                .assertUsesIndex(IDX_RECIPIENT_NOTIF)
                .assertExecutionTimeBelow(WRITE_BUDGET_MS)
                .assertExaminedAtMost(1);
    }

    @Test
    @DisplayName("Given a heavily seeded read_states collection, when markAllAsRead runs bulk update over recipient + status=UNREAD, then the update query plan uses recipient_status and stays within hot-recipient slice")
    void mark_all_as_read_uses_recipient_status_index() {
        Query query = Query.query(Criteria.where(FIELD_RECIPIENT_ID).is(HOT_ADMIN)
                .and(FIELD_RECIPIENT_TYPE).is(RecipientType.USER)
                .and(FIELD_STATUS).is(ReadStatus.UNREAD));
        Update update = new Update().set(FIELD_STATUS, ReadStatus.READ).set("readAt", Instant.now());

        Stats stats = MongoExplain.explainUpsert(mongoTemplate, READS_COLL, query, update);

        stats.assertNoCollectionScan()
                .assertUsesIndex(IDX_RECIPIENT_STATUS)
                .assertExecutionTimeBelow(WRITE_BUDGET_MS);
        stats.assertExaminedAtMost(HOT_ADMIN_NOTIFS * 2L);
    }

    @Test
    @DisplayName("Given a heavily seeded read_states collection, when unreadCountsByCategory aggregation runs (match recipient + status=UNREAD, group by category), then the $match stage hits recipient_category_status — no collscan during group aggregation")
    void unread_counts_by_category_uses_recipient_category_status_index() {
        var counts = readStateRepository.unreadCountsByCategory(HOT_ADMIN, RecipientType.USER, "test-tenant");
        assertThat(counts).isNotEmpty();

        List<Document> pipeline = List.of(
                new Document("$match", new Document(FIELD_RECIPIENT_ID, HOT_ADMIN)
                        .append(FIELD_RECIPIENT_TYPE, RecipientType.USER.name())
                        .append(FIELD_STATUS, ReadStatus.UNREAD.name())),
                new Document("$group", new Document("_id", "$" + FIELD_CATEGORY)
                        .append("count", new Document("$sum", 1))));

        Stats stats = MongoExplain.explainAggregation(mongoTemplate, READS_COLL, pipeline);

        stats.assertNoCollectionScan()
                .assertUsesAnyOf(IDX_RECIPIENT_CAT_ST, IDX_RECIPIENT_STATUS)
                .assertExecutionTimeBelow(FIND_BUDGET_MS);

        recorder.record("unreadCountsByCategory — admin USER aggregate",
                "groups", counts.size(),
                "executionTimeMs", stats.executionTimeMillis(),
                "keysExamined", stats.keysExamined(),
                "indexes", stats.indexesUsed());
    }

    @Test
    @DisplayName("Given a heavily seeded read_states collection, when softDeleteAllRead runs (update over recipient + status=READ), then the update plan hits recipient_status")
    void soft_delete_all_read_uses_recipient_status_index() {
        Query query = Query.query(Criteria.where(FIELD_RECIPIENT_ID).is(HOT_ADMIN)
                .and(FIELD_RECIPIENT_TYPE).is(RecipientType.USER)
                .and(FIELD_STATUS).is(ReadStatus.READ));
        Update update = new Update().set(FIELD_STATUS, ReadStatus.DELETED);

        Stats stats = MongoExplain.explainUpsert(mongoTemplate, READS_COLL, query, update);

        stats.assertNoCollectionScan()
                .assertUsesIndex(IDX_RECIPIENT_STATUS)
                .assertExecutionTimeBelow(WRITE_BUDGET_MS);
    }

    @Test
    @DisplayName("Given a heavily seeded read_states collection, when findPageForRecipient step 1 runs with readFilter=false (status=UNREAD equality), then it stays indexed — pinning the plan for the common bell-icon read-filter shape so optimizer flips don't go unnoticed")
    void list_for_recipient_unread_filter_uses_indexed_plan() {
        int limit = 25;
        Query q = readStateAudienceWithStatus(HOT_ADMIN, RecipientType.USER, ReadStatus.UNREAD, limit);

        Stats stats = MongoExplain.explainFind(mongoTemplate, READS_COLL, q);

        stats.assertNoCollectionScan()
                .assertUsesAnyOf(IDX_RECIPIENT_NOTIF, IDX_RECIPIENT_STATUS)
                .assertExecutionTimeBelow(FIND_BUDGET_MS);
        stats.assertExaminedAtMost(limit * 4L);
    }

    @Test
    @DisplayName("Given a heavily seeded read_states collection, when findPageForRecipient step 1 runs with readFilter=true (status=READ equality), then it stays indexed even when the matching slice is small/empty — guards against the optimizer falling back to collscan on selective filters")
    void list_for_recipient_read_filter_uses_indexed_plan() {
        int limit = 25;
        Query q = readStateAudienceWithStatus(HOT_ADMIN, RecipientType.USER, ReadStatus.READ, limit);

        Stats stats = MongoExplain.explainFind(mongoTemplate, READS_COLL, q);

        stats.assertNoCollectionScan()
                .assertUsesAnyOf(IDX_RECIPIENT_NOTIF, IDX_RECIPIENT_STATUS)
                .assertExecutionTimeBelow(FIND_BUDGET_MS);
        stats.assertExaminedAtMost(limit * 4L);
    }

    private static Query readStateAudienceQuery(String recipientId, RecipientType type, int limit) {
        Query q = Query.query(Criteria.where(FIELD_RECIPIENT_ID).is(recipientId)
                .and(FIELD_RECIPIENT_TYPE).is(type)
                .and(FIELD_STATUS).ne(ReadStatus.DELETED));
        q.fields().include(FIELD_NOTIFICATION_ID).include(FIELD_STATUS);
        q.with(Sort.by(Sort.Direction.DESC, FIELD_NOTIFICATION_ID));
        q.limit(limit);
        return q;
    }

    private static Query readStateAudienceWithStatus(String recipientId, RecipientType type, ReadStatus status, int limit) {
        Query q = Query.query(Criteria.where(FIELD_RECIPIENT_ID).is(recipientId)
                .and(FIELD_RECIPIENT_TYPE).is(type)
                .and(FIELD_STATUS).is(status));
        q.fields().include(FIELD_NOTIFICATION_ID).include(FIELD_STATUS);
        q.with(Sort.by(Sort.Direction.DESC, FIELD_NOTIFICATION_ID));
        q.limit(limit);
        return q;
    }

    private void seedNotifications() {
        BatchInserter inserter = new BatchInserter(mongoTemplate.getCollection(NOTIFS_COLL));
        for (int i = 0; i < NOTIF_TOTAL; i++) {
            ObjectId id = new ObjectId();
            inserter.add(notificationDocument(id, "perf-evt-" + i, contextTypeFor(i)));
            if (i < HOT_ADMIN_NOTIFS) {
                hotAdminNotifIds.add(id.toHexString());
            } else if (i < HOT_ADMIN_NOTIFS + HOT_MACHINE_NOTIFS) {
                hotMachineNotifIds.add(id.toHexString());
            }
        }
        inserter.flush();
    }

    private void seedReadStates() {
        BatchInserter inserter = new BatchInserter(mongoTemplate.getCollection(READS_COLL));
        for (int i = 0; i < hotAdminNotifIds.size(); i++) {
            inserter.add(readStateDocument(HOT_ADMIN, RecipientType.USER, hotAdminNotifIds.get(i),
                    ReadStatus.UNREAD, categoryFor(i)));
        }
        for (int i = 0; i < hotMachineNotifIds.size(); i++) {
            inserter.add(readStateDocument(HOT_MACHINE, RecipientType.MACHINE, hotMachineNotifIds.get(i),
                    ReadStatus.UNREAD, categoryFor(i)));
        }
        for (int i = 0; i < NOISE_READ_STATES; i++) {
            RecipientType type = (i % 2 == 0) ? RecipientType.USER : RecipientType.MACHINE;
            String recipientId = "noise-" + type.name().toLowerCase() + "-" + (i % 500);
            inserter.add(readStateDocument(recipientId, type, new ObjectId().toHexString(),
                    ReadStatus.UNREAD, categoryFor(i)));
        }
        inserter.flush();
    }

    private static String contextTypeFor(int index) {
        return switch (index % 3) {
            case 0 -> "TICKET_STATUS_CHANGED";
            case 1 -> "ADMIN_TICKET_APPROVAL_REQUEST";
            default -> "NEW_MINGO_MESSAGE";
        };
    }

    private static NotificationCategory categoryFor(int index) {
        return switch (index % 3) {
            case 0 -> NotificationCategory.TICKETS;
            case 1 -> NotificationCategory.MINGO;
            default -> NotificationCategory.GENERIC;
        };
    }

    private static Document notificationDocument(ObjectId id, String title, String contextType) {
        return new Document()
                .append("_id", id)
                .append("severity", "INFO")
                .append("title", title)
                .append("createdAt", new Date())
                .append("context", new Document("type", contextType).append("payload", "{}"));
    }

    private static Document readStateDocument(String recipientId, RecipientType recipientType,
                                              String notificationId, ReadStatus status, NotificationCategory category) {
        Document doc = new Document()
                .append("_id", new ObjectId())
                .append(FIELD_RECIPIENT_ID, recipientId)
                .append(FIELD_RECIPIENT_TYPE, recipientType.name())
                .append(FIELD_NOTIFICATION_ID, notificationId)
                .append(FIELD_STATUS, status.name())
                .append(FIELD_CATEGORY, category.name());
        if (status == ReadStatus.READ) {
            doc.append("readAt", new Date());
        }
        return doc;
    }

    private static final class BatchInserter {

        private final MongoCollection<Document> collection;
        private final List<Document> buffer = new ArrayList<>(BATCH_FLUSH_SIZE);

        BatchInserter(MongoCollection<Document> collection) {
            this.collection = collection;
        }

        void add(Document doc) {
            buffer.add(doc);
            if (buffer.size() >= BATCH_FLUSH_SIZE) {
                flush();
            }
        }

        void flush() {
            if (buffer.isEmpty()) {
                return;
            }
            collection.insertMany(buffer);
            buffer.clear();
        }
    }
}
