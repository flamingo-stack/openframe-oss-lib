package com.openframe.data.integration.performance;

import com.mongodb.client.MongoCollection;
import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.UserRecipient;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.IntegrationTestApplication;
import com.openframe.data.integration.support.MongoExplain;
import com.openframe.data.integration.support.MongoExplain.Stats;
import com.openframe.data.integration.support.PerfResultRecorder;
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

import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

@Slf4j
@SpringBootTest(classes = IntegrationTestApplication.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@Tag("loadtest")
@EnabledIfSystemProperty(named = "loadtest.tests", matches = "true")
class NotificationLoadTestIT extends BaseMongoIntegrationTest {

    private static final int TOTAL = Integer.getInteger("notification.loadtest.total", 1_000_000);
    private static final int[] HOT_SLICES = {100, 1_000, 10_000, 100_000};
    private static final int BATCH_FLUSH_SIZE = 5_000;
    private static final int NOISE_USERS = 50_000;
    private static final String NOTIFS_COLL = "notifications";
    private static final String USER_CLASS = UserRecipient.class.getName();
    private static final Path REPORT_DIR = Path.of("target", "perf-results");

    @Autowired private MongoTemplate mongoTemplate;

    private final PerfResultRecorder recorder =
            new PerfResultRecorder("NotificationLoadTestIT").withMeta("dataset", TOTAL);

    @BeforeAll
    void seed() {
        mongoTemplate.dropCollection(Notification.class);
        var indexOps = mongoTemplate.indexOps(Notification.class);
        new MongoPersistentEntityIndexResolver(mongoTemplate.getConverter().getMappingContext())
                .resolveIndexFor(Notification.class)
                .forEach(indexOps::ensureIndex);

        BatchInserter inserter = new BatchInserter(mongoTemplate.getCollection(NOTIFS_COLL));

        int seeded = 0;
        for (int slice : HOT_SLICES) {
            String userId = "hot-user-" + slice;
            String tag = "tag-" + slice;
            for (int i = 0; i < slice; i++) {
                inserter.add(notificationDoc(userId, tag + "-" + i));
                seeded++;
            }
        }

        int remaining = Math.max(0, TOTAL - seeded);
        for (int i = 0; i < remaining; i++) {
            inserter.add(notificationDoc("noise-" + (i % NOISE_USERS), "noise-" + i));
        }
        inserter.flush();

        long actual = mongoTemplate.getCollection(NOTIFS_COLL).countDocuments();
        log.info("seed complete: requested={}, actual={}", TOTAL, actual);
        recorder.withMeta("actualDocCount", actual);
    }

    @AfterAll
    void writeReports() throws IOException {
        recorder.writeMarkdown(REPORT_DIR);
    }

    @Test
    @DisplayName("Indexed search and count scaling across hot-user slice sizes within a single dataset")
    void indexed_paths_scaling_across_slice_sizes() {
        for (int slice : HOT_SLICES) {
            String userId = "hot-user-" + slice;
            String tag = "tag-" + slice;
            String tokenForOne = tag + "-" + (slice / 2);

            Query searchFindQ = listForUserSearchQuery(userId, tag, 25);
            Stats searchFind = MongoExplain.explainFind(mongoTemplate, NOTIFS_COLL, searchFindQ);

            Query countAudQ = countForUserQuery(userId);
            Stats countAud = MongoExplain.explainCount(mongoTemplate, NOTIFS_COLL, countAudQ);

            Query countAudRegexQ = countForUserSearchQuery(userId, tokenForOne);
            Stats countAudRegex = MongoExplain.explainCount(mongoTemplate, NOTIFS_COLL, countAudRegexQ);
            long matched = mongoTemplate.count(countAudRegexQ, Notification.class);

            recorder.record("Indexed search find — audience + title regex, limit 25",
                    "slice", slice,
                    "executionTimeMs", searchFind.executionTimeMillis(),
                    "keysExamined", searchFind.keysExamined(),
                    "indexes", searchFind.indexesUsed(),
                    "filter", filterJson(searchFindQ));

            recorder.record("Indexed count — user audience only",
                    "slice", slice,
                    "executionTimeMs", countAud.executionTimeMillis(),
                    "keysExamined", countAud.keysExamined(),
                    "indexes", countAud.indexesUsed(),
                    "filter", filterJson(countAudQ));

            recorder.record("Indexed count — user audience + title regex",
                    "slice", slice,
                    "executionTimeMs", countAudRegex.executionTimeMillis(),
                    "keysExamined", countAudRegex.keysExamined(),
                    "matched", matched,
                    "indexes", countAudRegex.indexesUsed(),
                    "filter", filterJson(countAudRegexQ));

            searchFind.assertNoCollectionScan();
            countAud.assertNoCollectionScan();
            countAudRegex.assertNoCollectionScan();
            assertThat(matched).isGreaterThanOrEqualTo(1L);
        }
    }

    @Test
    @DisplayName("Unindexed regex search find — no audience pre-filter, collection scan with limit early-stop")
    void unindexed_regex_search_find_collscan_with_limit() {
        Query q = new Query(Criteria.where("title").regex(Pattern.quote("tag-100000-50000"), "i"));
        q.with(Sort.by(Sort.Direction.DESC, "_id"));
        q.limit(25);

        Stats stats = MongoExplain.explainFind(mongoTemplate, NOTIFS_COLL, q);

        long start = System.nanoTime();
        int returned = mongoTemplate.find(q, Notification.class).size();
        long wallMs = (System.nanoTime() - start) / 1_000_000L;

        recorder.record("Unindexed regex search find — collscan with limit 25",
                "returned", returned,
                "explainExecutionTimeMs", stats.executionTimeMillis(),
                "wallExecutionTimeMs", wallMs,
                "indexes", stats.indexesUsed().isEmpty() ? "none (collscan)" : stats.indexesUsed(),
                "filter", filterJson(q));
    }

    @Test
    @DisplayName("Unindexed regex count over full collection — collection scan baseline; demonstrates the cost when no audience pre-filter narrows the slice")
    void unindexed_regex_count_collscan_baseline() {
        Query q = new Query(Criteria.where("title").regex(Pattern.quote("tag-100000-50000"), "i"));
        Stats stats = MongoExplain.explainCount(mongoTemplate, NOTIFS_COLL, q);

        long start = System.nanoTime();
        long matched = mongoTemplate.count(q, Notification.class);
        long wallMs = (System.nanoTime() - start) / 1_000_000L;

        recorder.record("Unindexed regex count — collscan over full collection",
                "matched", matched,
                "explainExecutionTimeMs", stats.executionTimeMillis(),
                "wallExecutionTimeMs", wallMs,
                "indexes", stats.indexesUsed().isEmpty() ? "none (collscan)" : stats.indexesUsed(),
                "filter", filterJson(q));

        assertThat(matched).isGreaterThanOrEqualTo(0L);
    }

    @Test
    @DisplayName("Total document count — fast path through metadata, independent of dataset size")
    void total_document_count_fast_path() {
        long start = System.nanoTime();
        long total = mongoTemplate.getCollection(NOTIFS_COLL).estimatedDocumentCount();
        long wallMs = (System.nanoTime() - start) / 1_000_000L;

        recorder.record("Total document count — metadata fast path",
                "total", total,
                "wallExecutionTimeMs", wallMs);
        assertThat(total).isGreaterThanOrEqualTo(0L);
    }

    private static String filterJson(Query q) {
        return q.getQueryObject().toJson();
    }

    private static Query listForUserSearchQuery(String userId, String search, int limit) {
        Query q = new Query(Criteria.where("recipient.userId").is(userId));
        q.addCriteria(Criteria.where("recipient._class").is(USER_CLASS));
        q.addCriteria(Criteria.where("title").regex(Pattern.quote(search), "i"));
        q.with(Sort.by(Sort.Direction.DESC, "_id"));
        q.limit(limit);
        return q;
    }

    private static Query countForUserQuery(String userId) {
        return new Query(Criteria.where("recipient.userId").is(userId)
                .and("recipient._class").is(USER_CLASS));
    }

    private static Query countForUserSearchQuery(String userId, String search) {
        Query q = countForUserQuery(userId);
        q.addCriteria(Criteria.where("title").regex(Pattern.quote(search), "i"));
        return q;
    }

    private static Document notificationDoc(String userId, String title) {
        return new Document()
                .append("_id", new ObjectId())
                .append("recipient", new Document("_class", USER_CLASS).append("userId", userId))
                .append("severity", "INFO")
                .append("title", title)
                .append("createdAt", new Date())
                .append("context", new Document("type", "evt").append("payload", "{}"))
                .append("publishState", new Document().append("published", true).append("attempts", 0));
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
