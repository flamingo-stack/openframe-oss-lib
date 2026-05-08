package com.openframe.data.integration.performance;

import com.mongodb.client.MongoCollection;
import com.openframe.data.document.notification.BroadcastRecipient;
import com.openframe.data.document.notification.MachineRecipient;
import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.NotificationReadState;
import com.openframe.data.document.notification.UserRecipient;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.IntegrationTestApplication;
import com.openframe.data.integration.support.MongoExplain;
import com.openframe.data.integration.support.MongoExplain.Stats;
import com.openframe.data.repository.notification.NotificationReadStateRepository;
import com.openframe.data.repository.notification.NotificationRepository;
import org.bson.Document;
import org.bson.types.ObjectId;
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

import java.time.Instant;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = IntegrationTestApplication.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@Tag("performance")
@EnabledIfSystemProperty(named = "performance.tests", matches = "true")
class NotificationIndexUsageIT extends BaseMongoIntegrationTest {

    private static final int NOTIF_TOTAL        = Integer.getInteger("perf.notifications.count", 30_000);
    private static final int HOT_USER_NOTIFS    = Integer.getInteger("perf.notifications.hotUser", 3_000);
    private static final int HOT_MACHINE_NOTIFS = Integer.getInteger("perf.notifications.hotMachine", 1_000);
    private static final int RETRY_CANDIDATES   = Integer.getInteger("perf.notifications.retryable", 100);
    private static final int READ_STATE_TOTAL   = Integer.getInteger("perf.readStates.count", 20_000);
    private static final int HOT_USER_READS     = Integer.getInteger("perf.readStates.hotUser", 10_000);

    private static final int BATCH_FLUSH_SIZE = 2_000;

    private static final String HOT_USER    = "user-hot";
    private static final String HOT_MACHINE = "machine-hot";
    private static final String NOTIFS_COLL = "notifications";
    private static final String READS_COLL  = "notification_read_states";

    private static final String IDX_RECIPIENT_USER    = "recipient_user_id";
    private static final String IDX_RECIPIENT_MACHINE = "recipient_machine_id";
    private static final String IDX_USER_NOTIF        = "user_notification_unique";

    private static final String BROADCAST_CLASS = BroadcastRecipient.class.getName();
    private static final String USER_CLASS = UserRecipient.class.getName();
    private static final String MACHINE_CLASS = MachineRecipient.class.getName();

    private static final long FIND_BUDGET_MS  = 200;
    private static final long WRITE_BUDGET_MS = 100;

    @Autowired private NotificationRepository notificationRepository;
    @Autowired private NotificationReadStateRepository readStateRepository;
    @Autowired private MongoTemplate mongoTemplate;

    private final List<String> hotUserNotifIds = new ArrayList<>();

    @BeforeAll
    void seedDataset() {
        mongoTemplate.dropCollection(Notification.class);
        mongoTemplate.dropCollection(NotificationReadState.class);

        ensureIndexes(Notification.class);
        ensureIndexes(NotificationReadState.class);

        seedNotifications();
        seedReadStates();
    }

    private void ensureIndexes(Class<?> entityClass) {
        var indexOps = mongoTemplate.indexOps(entityClass);
        new MongoPersistentEntityIndexResolver(mongoTemplate.getConverter().getMappingContext())
                .resolveIndexFor(entityClass)
                .forEach(indexOps::ensureIndex);
    }

    @Test
    @DisplayName("findPageForUser hits recipient_user_id and only examines about page-size keys")
    void list_for_user_uses_recipient_user_index() {
        int limit = 25;

        List<Notification> page = notificationRepository.findPageForUser(HOT_USER, null, false, limit);
        assertThat(page).hasSize(limit);
        assertThat(page).allSatisfy(n -> assertThat(matchesUserOrBroadcast(n, HOT_USER)).isTrue());

        Stats stats = MongoExplain.explainFind(mongoTemplate, NOTIFS_COLL, listForUserQuery(HOT_USER, limit));

        stats.assertNoCollectionScan()
                .assertUsesIndex(IDX_RECIPIENT_USER)
                .assertExecutionTimeBelow(FIND_BUDGET_MS);

        stats.assertExaminedAtMost(limit * 4L);
    }

    @Test
    @DisplayName("findPageForMachine hits recipient_machine_id and only examines about page-size keys")
    void list_for_machine_uses_recipient_machine_index() {
        int limit = 25;

        List<Notification> page = notificationRepository.findPageForMachine(HOT_MACHINE, null, false, limit);
        assertThat(page).hasSize(limit);
        assertThat(page).allSatisfy(n -> assertThat(matchesMachineOrBroadcast(n, HOT_MACHINE)).isTrue());

        Stats stats = MongoExplain.explainFind(mongoTemplate, NOTIFS_COLL, listForMachineQuery(HOT_MACHINE, limit));

        stats.assertNoCollectionScan()
                .assertUsesIndex(IDX_RECIPIENT_MACHINE)
                .assertExecutionTimeBelow(FIND_BUDGET_MS);
        stats.assertExaminedAtMost(limit * 4L);
    }

    @Test
    @DisplayName("findRecentIdsForUser projects only _id and stays on the recipient indexes — no full collection scan even at high limits")
    void bell_badge_uses_index_and_does_not_collscan() {
        int limit = 50;

        List<String> ids = notificationRepository.findRecentIdsForUser(HOT_USER, limit);
        assertThat(ids).hasSize(limit);

        Stats stats = MongoExplain.explainFind(mongoTemplate, NOTIFS_COLL, recentIdsForUserQuery(HOT_USER, limit));

        stats.assertNoCollectionScan()
                .assertUsesIndex(IDX_RECIPIENT_USER)
                .assertExecutionTimeBelow(FIND_BUDGET_MS);
        stats.assertExaminedAtMost(limit * 4L);
    }

    @Test
    @DisplayName("markRead upsert uses user_notification_unique — single-key lookup even on a heavily populated read-state table")
    void mark_read_uses_unique_compound_index() {
        String freshNotifId = "perf-fresh-" + UUID.randomUUID();

        boolean inserted = readStateRepository.markRead(HOT_USER, freshNotifId);
        assertThat(inserted).isTrue();

        String explainNotifId = "perf-explain-" + UUID.randomUUID();
        Query query = Query.query(
                Criteria.where("userId").is(HOT_USER)
                        .and("notificationId").is(explainNotifId));
        Update update = new Update()
                .setOnInsert("userId", HOT_USER)
                .setOnInsert("notificationId", explainNotifId)
                .setOnInsert("readAt", Instant.now());

        Stats stats = MongoExplain.explainUpsert(mongoTemplate, READS_COLL, query, update);

        stats.assertNoCollectionScan()
                .assertUsesIndex(IDX_USER_NOTIF)
                .assertExecutionTimeBelow(WRITE_BUDGET_MS)
                .assertExaminedAtMost(1);
    }

    @Test
    @DisplayName("findReadIds with a 25-element IN list uses user_notification_unique — keys examined stay within the IN-list bound")
    void find_read_ids_uses_unique_compound_index() {
        List<String> probe = sample(hotUserNotifIds, 20);
        for (int i = 0; i < 5; i++) {
            probe.add("missing-" + UUID.randomUUID());
        }

        var hits = readStateRepository.findReadIds(HOT_USER, probe);
        assertThat(hits).isSubsetOf(probe);

        Query query = Query.query(
                Criteria.where("userId").is(HOT_USER)
                        .and("notificationId").in(probe));
        query.fields().include("notificationId");

        Stats stats = MongoExplain.explainFind(mongoTemplate, READS_COLL, query);

        stats.assertNoCollectionScan()
                .assertUsesIndex(IDX_USER_NOTIF)
                .assertExecutionTimeBelow(FIND_BUDGET_MS);

        stats.assertExaminedAtMost(probe.size() * 2L);
    }

    @Test
    @DisplayName("findRetryablePublishCandidates does not collection-scan — only the unpublished slice should be touched")
    void retryable_candidates_does_not_collscan() {
        int batch = 100;

        List<Notification> candidates = notificationRepository.findRetryablePublishCandidates(5, batch);
        assertThat(candidates).isNotEmpty();

        Stats stats = MongoExplain.explainFind(mongoTemplate, NOTIFS_COLL, retryableCandidatesQuery(5, batch));

        stats.assertNoCollectionScan()
                .assertExecutionTimeBelow(FIND_BUDGET_MS);

        long ceiling = Math.max(RETRY_CANDIDATES * 4L, batch * 4L);
        stats.assertExaminedAtMost(ceiling);
    }

    private static boolean matchesUserOrBroadcast(Notification n, String userId) {
        return n.getRecipient() instanceof UserRecipient u && userId.equals(u.userId())
                || n.getRecipient() instanceof BroadcastRecipient;
    }

    private static boolean matchesMachineOrBroadcast(Notification n, String machineId) {
        return n.getRecipient() instanceof MachineRecipient m && machineId.equals(m.machineId())
                || n.getRecipient() instanceof BroadcastRecipient;
    }

    private static Query listForUserQuery(String userId, int limit) {
        Query q = new Query(new Criteria().orOperator(
                Criteria.where("recipient.userId").is(userId),
                Criteria.where("recipient._class").is(BROADCAST_CLASS)));
        q.with(Sort.by(Sort.Direction.DESC, "_id"));
        q.limit(limit);
        return q;
    }

    private static Query listForMachineQuery(String machineId, int limit) {
        Query q = new Query(new Criteria().orOperator(
                Criteria.where("recipient.machineId").is(machineId),
                Criteria.where("recipient._class").is(BROADCAST_CLASS)));
        q.with(Sort.by(Sort.Direction.DESC, "_id"));
        q.limit(limit);
        return q;
    }

    private static Query recentIdsForUserQuery(String userId, int limit) {
        Query q = listForUserQuery(userId, limit);
        q.fields().include("_id");
        return q;
    }

    private static Query retryableCandidatesQuery(int maxAttempts, int limit) {
        Query q = new Query(Criteria.where("publishState.published").is(false)
                .and("publishState.attempts").lt(maxAttempts));
        q.with(Sort.by(Sort.Direction.ASC, "_id"));
        q.limit(limit);
        return q;
    }

    private void seedNotifications() {
        long retrySliceStart = NOTIF_TOTAL - RETRY_CANDIDATES;
        BatchInserter inserter = new BatchInserter(mongoTemplate.getCollection(NOTIFS_COLL));

        for (int i = 0; i < NOTIF_TOTAL; i++) {
            Target target = targetFor(i);
            boolean unpublished = i >= retrySliceStart;
            Document doc = notificationDocument(target, "perf-evt-" + i, unpublished);

            if (target.userId() != null && HOT_USER.equals(target.userId())) {
                hotUserNotifIds.add(doc.getObjectId("_id").toHexString());
            }
            inserter.add(doc);
        }
        inserter.flush();
    }

    private void seedReadStates() {
        BatchInserter inserter = new BatchInserter(mongoTemplate.getCollection(READS_COLL));

        int hotReads = Math.min(HOT_USER_READS, hotUserNotifIds.size());
        for (int i = 0; i < hotReads; i++) {
            inserter.add(readStateDocument(HOT_USER, hotUserNotifIds.get(i)));
        }
        int noise = Math.max(0, READ_STATE_TOTAL - hotReads);
        for (int i = 0; i < noise; i++) {
            inserter.add(readStateDocument("user-noise-" + (i % 200), "noise-notif-" + i));
        }
        inserter.flush();
    }

    private record Target(String userId, String machineId) {
        static Target hotUser()        { return new Target(HOT_USER, null); }
        static Target hotMachine()     { return new Target(null, HOT_MACHINE); }
        static Target noise(int index) { return new Target("user-noise-" + (index % 100), null); }
    }

    private static Target targetFor(int index) {
        if (index < HOT_USER_NOTIFS) {
            return Target.hotUser();
        }
        if (index < HOT_USER_NOTIFS + HOT_MACHINE_NOTIFS) {
            return Target.hotMachine();
        }
        return Target.noise(index);
    }

    private static Document notificationDocument(Target target, String title, boolean unpublished) {
        Document doc = new Document()
                .append("_id", new ObjectId())
                .append("severity", "INFO")
                .append("title", title)
                .append("createdAt", new Date())
                .append("context", new Document("type", "welcome").append("payload", "{}"))
                .append("publishState", publishStateDocument(unpublished));
        if (target.userId() != null) {
            doc.append("recipient", new Document("_class", USER_CLASS).append("userId", target.userId()));
        } else if (target.machineId() != null) {
            doc.append("recipient", new Document("_class", MACHINE_CLASS).append("machineId", target.machineId()));
        }
        return doc;
    }

    private static Document publishStateDocument(boolean unpublished) {
        Document state = new Document()
                .append("published", !unpublished)
                .append("attempts", unpublished ? ThreadLocalRandom.current().nextInt(0, 4) : 0);
        if (!unpublished) {
            state.append("publishedAt", new Date());
        }
        return state;
    }

    private static Document readStateDocument(String userId, String notificationId) {
        return new Document()
                .append("_id", new ObjectId())
                .append("userId", userId)
                .append("notificationId", notificationId)
                .append("readAt", new Date());
    }

    private static <T> List<T> sample(List<T> source, int n) {
        List<T> out = new ArrayList<>(n);
        int size = source.size();
        for (int i = 0; i < n && size > 0; i++) {
            out.add(source.get(ThreadLocalRandom.current().nextInt(size)));
        }
        return out;
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
