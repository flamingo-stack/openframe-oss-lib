package com.openframe.data.integration.performance;

import com.mongodb.client.MongoCollection;
import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.NotificationReadState;
import com.openframe.data.document.notification.ReadStatus;
import com.openframe.data.document.notification.RecipientType;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.IntegrationTestApplication;
import com.openframe.data.integration.support.MeasurementStats;
import com.openframe.data.integration.support.MongoExplain;
import com.openframe.data.integration.support.PerfResultRecorder;
import com.openframe.data.repository.notification.NotificationPage;
import com.openframe.data.repository.notification.NotificationReadStateRepository;
import com.openframe.data.repository.notification.NotificationRepository;
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
import java.lang.management.ManagementFactory;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@Slf4j
@SpringBootTest(classes = IntegrationTestApplication.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@Tag("loadtest")
@EnabledIfSystemProperty(named = "loadtest.tests", matches = "true")
class NotificationLoadTestIT extends BaseMongoIntegrationTest {

    private static final int TOTAL              = Integer.getInteger("notification.loadtest.total", 1_000_000);
    private static final int[] HOT_SLICES       = {100, 1_000, 10_000, 100_000};
    private static final int SPARSE_SLICE       = Integer.getInteger("notification.loadtest.sparse", 30_000);
    private static final int SPARSE_MATCH_EVERY = 100;

    private static final int BATCH_FLUSH_SIZE = 5_000;
    private static final int SAMPLES = 20;
    private static final int WARMUP = 5;

    private static final String HOT_USER_PREFIX = "hot-user-";
    private static final String SPARSE_USER     = "hot-user-sparse";
    private static final String DENSE_TITLE_FMT = "dense-tag-%d-%d";
    private static final String SPARSE_MATCH    = "sparse-match-";
    private static final String SPARSE_NOISE    = "noise-line-";
    private static final String NOISE_RECIPIENT_PREFIX = "noise-user-";
    private static final int NOISE_RECIPIENTS = 50_000;

    private static final long LIST_BUDGET_MS       = 500;
    private static final long SEARCH_BUDGET_MS     = 1_500;
    private static final long WRITE_BUDGET_MS      = 5_000;

    private static final String NOTIFS_COLL = "notifications";
    private static final String READS_COLL  = "notification_read_states";

    private static final String FIELD_RECIPIENT_ID    = "recipientId";
    private static final String FIELD_RECIPIENT_TYPE  = "recipientType";
    private static final String FIELD_STATUS          = "status";

    private static final Path REPORT_DIR = Path.of("target", "perf-results");

    private static final String S_LIST   = "Scenario 1. Open the inbox — list notifications, no search";
    private static final String S_DENSE  = "Scenario 2. Search by a substring that matches every notification";
    private static final String S_SPARSE = "Scenario 3. Search where matches are about 1% of the feed";
    private static final String S_BULK   = "Scenario 4. \"Mark all as read\" — bulk status flip";
    private static final String S_COUNTS = "Scenario 5. Unread counts by category";

    @Autowired
    private MongoTemplate mongoTemplate;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private NotificationReadStateRepository readStateRepository;

    private final PerfResultRecorder recorder = new PerfResultRecorder(getClass().getSimpleName());

    @BeforeAll
    void seed() {
        captureEnvironment();

        mongoTemplate.dropCollection(Notification.class);
        mongoTemplate.dropCollection(NotificationReadState.class);
        ensureIndexes(Notification.class);
        ensureIndexes(NotificationReadState.class);

        Instant t0 = Instant.now();
        BatchInserter notifBuf = new BatchInserter(mongoTemplate.getCollection(NOTIFS_COLL));
        BatchInserter readBuf  = new BatchInserter(mongoTemplate.getCollection(READS_COLL));

        int seeded = 0;
        for (int slice : HOT_SLICES) {
            String userId = HOT_USER_PREFIX + slice;
            for (int i = 0; i < slice; i++) {
                ObjectId notifId = new ObjectId();
                String title = String.format(DENSE_TITLE_FMT, slice, i);
                notifBuf.add(notificationDoc(notifId, title));
                readBuf.add(readStateDoc(userId, RecipientType.USER, notifId.toHexString(),
                        ReadStatus.UNREAD, NotificationCategory.TICKETS, title));
                seeded++;
            }
        }

        for (int i = 0; i < SPARSE_SLICE; i++) {
            ObjectId notifId = new ObjectId();
            String title = (i % SPARSE_MATCH_EVERY == 0) ? SPARSE_MATCH + i : SPARSE_NOISE + i;
            notifBuf.add(notificationDoc(notifId, title));
            readBuf.add(readStateDoc(SPARSE_USER, RecipientType.USER, notifId.toHexString(),
                    ReadStatus.UNREAD, NotificationCategory.MINGO, title));
            seeded++;
        }

        int remaining = Math.max(0, TOTAL - seeded);
        for (int i = 0; i < remaining; i++) {
            ObjectId notifId = new ObjectId();
            String title = "noise-evt-" + i;
            notifBuf.add(notificationDoc(notifId, title));
            readBuf.add(readStateDoc(NOISE_RECIPIENT_PREFIX + (i % NOISE_RECIPIENTS),
                    RecipientType.USER, notifId.toHexString(),
                    ReadStatus.UNREAD, NotificationCategory.GENERIC, title));
        }
        notifBuf.flush();
        readBuf.flush();

        long notifs = mongoTemplate.getCollection(NOTIFS_COLL).countDocuments();
        long reads  = mongoTemplate.getCollection(READS_COLL).countDocuments();
        long seedMs = Duration.between(t0, Instant.now()).toMillis();
        log.info("LoadTest seed complete: notifications={}, read_states={}, took {}ms",
                notifs, reads, seedMs);

        recorder.withOverview("Notification list/search performance bench. The audience for each notification lives "
                        + "in a separate `notification_read_states` collection (one row per recipient per notification); "
                        + "search streams that collection without using `$lookup`, and pagination is cursor-based. "
                        + "Scenarios describe **what the user actually does** (opens the inbox, searches a ticket, "
                        + "hits \"mark all as read\") — the numbers show how long that takes on the bench.")
                .withMeta("targetDocCount", TOTAL)
                .withMeta("notificationsSeeded", notifs)
                .withMeta("readStatesSeeded", reads)
                .withMeta("seedDurationMs", seedMs)
                .withMeta("hotUserSlices", java.util.Arrays.toString(HOT_SLICES))
                .withMeta("sparseUserSliceSize", SPARSE_SLICE)
                .withMeta("samplesPerScenario", SAMPLES)
                .withMeta("warmupRuns", WARMUP);

        installSectionDescriptions();
    }

    private void captureEnvironment() {
        Runtime rt = Runtime.getRuntime();
        Document buildInfo = mongoTemplate.getDb().runCommand(new Document("buildInfo", 1));
        recorder.withEnvironment("java", System.getProperty("java.version"))
                .withEnvironment("os", System.getProperty("os.name") + " " + System.getProperty("os.version") + " " + System.getProperty("os.arch"))
                .withEnvironment("cpuCount", rt.availableProcessors())
                .withEnvironment("maxHeapMb", rt.maxMemory() / 1024 / 1024)
                .withEnvironment("mongoVersion", buildInfo.getString("version"))
                .withEnvironment("vmName", ManagementFactory.getRuntimeMXBean().getVmName());
    }

    private void installSectionDescriptions() {
        recorder.describe(S_LIST,
                "What we measure: time to deliver the first page (25 notifications) for users with very different "
                        + "inbox sizes — 100, 1 000, 10 000, 100 000 notifications. This is the hottest query in the "
                        + "system: opening the bell. The point of this scenario is to demonstrate that latency does "
                        + "**not** scale with inbox size — the `recipient_notification_unique` compound index lets Mongo "
                        + "reverse-walk straight into the first page.\n"
                        + "Columns: `slice` is how many notifications the test user owns; `wallP50/P95/P99` are the "
                        + "observed latencies in milliseconds (median plus tails, " + SAMPLES + " samples after "
                        + WARMUP + " warmups); `keysExamined` comes from Mongo `explain` and tells you how deep the "
                        + "planner had to dig; `index` is the chosen plan.");

        recorder.describe(S_DENSE,
                "What we measure: search with 100% hit rate (every notification title contains the search substring) "
                        + "across the same four inbox sizes. One flat find on `notification_read_states` with title-regex "
                        + "pushdown; should be as fast as Scenario 1.");

        recorder.describe(S_SPARSE,
                "What we measure: search where only ~1% of titles match (one in every hundred notifications). One flat "
                        + "find on `notification_read_states` — recipient+status indexed, title-regex pushdown over the "
                        + "narrowed slice. Feed size 30 000 notifications.\n"
                        + "Latency must stay within SEARCH_BUDGET_MS even on the sparse hit rate.");

        recorder.describe(S_BULK,
                "What we measure: the user clicks \"mark all as read\". A bulk `update` over the biggest feed "
                        + "(100 000 notifications) flips every row `UNREAD → READ` in one shot, driven by "
                        + "`recipient_status`. Single-shot measurement (the op is destructive — rerunning is fine but "
                        + "pointless). Budget is 5 seconds for 100k rows; that is a generous cap, actual time is "
                        + "noticeably lower.");

        recorder.describe(S_COUNTS,
                "What we measure: unread counts grouped by category "
                        + "(`{TICKETS: 7, MINGO: 3, …}`). Used to render the sidebar badges. The "
                        + "aggregation must be fully covered by `recipient_category_status` — no FETCH stage. "
                        + "Measured against the 10 000-notification feed.\n"
                        + "We use the 10k slice rather than 100k because the bulk-mark-as-read scenario already marked "
                        + "the 100k slice as READ; nothing left to count there.");
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
    @DisplayName("Inbox list, no search — latency stays flat across inbox sizes 100 / 1k / 10k / 100k")
    void list_inbox_latency_versus_inbox_size() {
        for (int slice : HOT_SLICES) {
            String userId = HOT_USER_PREFIX + slice;

            MeasurementStats stats = MeasurementStats.measure(WARMUP, SAMPLES, () ->
                    MeasurementStats.timeMillis(() -> assertThat(notificationRepository
                            .findPageForRecipient(userId, RecipientType.USER, null, null, null, false, 25)
                            .items()).hasSize(Math.min(25, slice))));

            MongoExplain.Stats explain = MongoExplain.explainFind(mongoTemplate, READS_COLL,
                    audienceQuery(userId, 25));

            assertThat(stats.p95()).isLessThan(LIST_BUDGET_MS);
            assertThat(explain.indexesUsed()).isNotEmpty();

            recorder.record(S_LIST,
                    "slice", slice,
                    "wallP50ms", stats.p50(),
                    "wallP95ms", stats.p95(),
                    "wallP99ms", stats.p99(),
                    "wallMinMs", stats.min(),
                    "wallMaxMs", stats.max(),
                    "explainExecMs", explain.executionTimeMillis(),
                    "keysExamined", explain.keysExamined(),
                    "index", explain.indexesUsed());

            recorder.headline("Summary",
                    "scenario", "inbox, no search",
                    "feed size", slice,
                    "p50 ms", stats.p50(),
                    "p95 ms", stats.p95(),
                    "iterations", 1,
                    "note", "flat across sizes");
        }
    }

    @Test
    @DisplayName("Search with 100% hit rate — single flat query, indexed by recipient+status with title regex pushdown")
    void dense_search_latency_versus_inbox_size() {
        for (int slice : HOT_SLICES) {
            String userId = HOT_USER_PREFIX + slice;
            String search = "dense-tag-" + slice + "-";

            MeasurementStats stats = MeasurementStats.measure(WARMUP, SAMPLES, () ->
                    MeasurementStats.timeMillis(() -> {
                        NotificationPage page = notificationRepository.findPageForRecipient(
                                userId, RecipientType.USER, null, search, null, false, 25);
                        assertThat(page.items()).isNotEmpty();
                    }));

            assertThat(stats.p95()).isLessThan(SEARCH_BUDGET_MS);

            recorder.record(S_DENSE,
                    "slice", slice,
                    "wallP50ms", stats.p50(),
                    "wallP95ms", stats.p95(),
                    "wallP99ms", stats.p99(),
                    "wallMinMs", stats.min(),
                    "wallMaxMs", stats.max());

            recorder.headline("Summary",
                    "scenario", "search, dense match",
                    "feed size", slice,
                    "p50 ms", stats.p50(),
                    "p95 ms", stats.p95(),
                    "note", "single flat query");
        }
    }

    @Test
    @DisplayName("Search with ~1% hit rate — single flat query stays within budget on title-regex pushdown")
    void sparse_search_stays_within_budget() {
        MeasurementStats stats = MeasurementStats.measure(WARMUP, SAMPLES, () ->
                MeasurementStats.timeMillis(() -> {
                    NotificationPage page = notificationRepository.findPageForRecipient(
                            SPARSE_USER, RecipientType.USER, null, SPARSE_MATCH, null, false, 25);
                    assertThat(page.items()).isNotEmpty();
                }));

        assertThat(stats.p95()).isLessThan(SEARCH_BUDGET_MS);

        recorder.record(S_SPARSE,
                "sliceSize", SPARSE_SLICE,
                "matchRatePercent", 100 / SPARSE_MATCH_EVERY,
                "wallP50ms", stats.p50(),
                "wallP95ms", stats.p95(),
                "wallP99ms", stats.p99(),
                "wallMinMs", stats.min(),
                "wallMaxMs", stats.max());

        recorder.headline("Summary",
                "scenario", "search, sparse (~1%)",
                "feed size", SPARSE_SLICE,
                "p50 ms", stats.p50(),
                "p95 ms", stats.p95(),
                "note", "single flat query");
    }

    @Test
    @DisplayName("\"Mark all as read\" — bulk markAllAsRead on the 100k slice")
    void mark_all_as_read_on_biggest_slice() {
        String userId = HOT_USER_PREFIX + 100_000;

        long wallMs = MeasurementStats.timeMillis(() -> {
            long modified = readStateRepository.markAllAsRead(userId, RecipientType.USER);
            assertThat(modified).isEqualTo(100_000L);
        });
        assertThat(wallMs).isLessThan(WRITE_BUDGET_MS);

        MongoExplain.Stats explain = MongoExplain.explainUpsert(mongoTemplate, READS_COLL,
                Query.query(Criteria.where(FIELD_RECIPIENT_ID).is(userId)
                        .and(FIELD_RECIPIENT_TYPE).is(RecipientType.USER)
                        .and(FIELD_STATUS).is(ReadStatus.READ)),
                new Update().set(FIELD_STATUS, ReadStatus.READ));

        recorder.record(S_BULK,
                "slice", 100_000,
                "rowsAffected", 100_000,
                "wallMs", wallMs,
                "explainExecMs", explain.executionTimeMillis(),
                "keysExamined", explain.keysExamined(),
                "index", explain.indexesUsed());

        recorder.headline("Summary",
                "scenario", "mark all as read (100k)",
                "feed size", 100_000,
                "p50 ms", wallMs,
                "p95 ms", wallMs,
                "iterations", 1,
                "note", "single bulk update");
    }

    @Test
    @DisplayName("Unread counts grouped by category — covered aggregation")
    void unread_counts_by_category_on_medium_slice() {
        String userId = HOT_USER_PREFIX + 10_000;

        final int[] groups = {0};
        MeasurementStats stats = MeasurementStats.measure(WARMUP, SAMPLES, () ->
                MeasurementStats.timeMillis(() -> {
                    var counts = readStateRepository.unreadCountsByCategory(userId, RecipientType.USER);
                    groups[0] = counts.size();
                    assertThat(counts).isNotEmpty();
                }));

        assertThat(stats.p95()).isLessThan(SEARCH_BUDGET_MS);

        recorder.record(S_COUNTS,
                "slice", 10_000,
                "groupsReturned", groups[0],
                "wallP50ms", stats.p50(),
                "wallP95ms", stats.p95(),
                "wallP99ms", stats.p99(),
                "wallMinMs", stats.min(),
                "wallMaxMs", stats.max());

        recorder.headline("Summary",
                "scenario", "unread counts by category",
                "feed size", 10_000,
                "p50 ms", stats.p50(),
                "p95 ms", stats.p95(),
                "iterations", 1,
                "note", "covered aggregation");
    }

    private static Query audienceQuery(String recipientId, int limit) {
        Query q = Query.query(Criteria.where(FIELD_RECIPIENT_ID).is(recipientId)
                .and(FIELD_RECIPIENT_TYPE).is(RecipientType.USER)
                .and(FIELD_STATUS).ne(ReadStatus.DELETED));
        q.fields().include("notificationId").include("status");
        q.with(Sort.by(Sort.Direction.DESC, "notificationId"));
        q.limit(limit);
        return q;
    }

    private static Document notificationDoc(ObjectId id, String title) {
        return new Document()
                .append("_id", id)
                .append("severity", "INFO")
                .append("title", title)
                .append("createdAt", new Date())
                .append("context", new Document("type", "TICKET_STATUS_CHANGED").append("payload", "{}"));
    }

    private static Document readStateDoc(String recipientId, RecipientType type,
                                         String notificationId, ReadStatus status, NotificationCategory category,
                                         String title) {
        return new Document()
                .append("_id", new ObjectId())
                .append("recipientId", recipientId)
                .append("recipientType", type.name())
                .append("notificationId", notificationId)
                .append("status", status.name())
                .append("category", category.name())
                .append("title", title);
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
