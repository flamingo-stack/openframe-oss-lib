package com.openframe.processing.runner;

import com.openframe.processing.config.EventProcessingAutoConfiguration;
import com.openframe.processing.exception.EventProcessingFailedException;
import com.openframe.processing.fixture.Widgets.WidgetEvent;
import com.openframe.processing.fixture.Widgets.WidgetSpec;
import com.openframe.processing.version.ProjectionVersion;
import com.openframe.processing.version.ProjectionVersionRepository;
import com.openframe.publishing.api.model.PublishedRecord;
import com.openframe.publishing.api.model.ReconciliationResult;
import com.openframe.publishing.api.spec.Projection;
import com.openframe.publishing.registry.AggregateSpecRegistry;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.bson.Document;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.data.mongodb.autoconfigure.DataMongoAutoConfiguration;
import org.springframework.boot.mongodb.autoconfigure.MongoAutoConfiguration;
import org.springframework.boot.test.context.assertj.AssertableApplicationContext;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.data.mongodb.core.MongoOperations;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mongodb.MongoDBContainer;
import org.testcontainers.utility.DockerImageName;

import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

// The version and the copies are written in one transaction, so two consumers of one aggregate cannot cross.
@Testcontainers
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class ProjectionRunnerTransactionIT {

    @Container
    static final MongoDBContainer MONGO = new MongoDBContainer(DockerImageName.parse("mongo:7")).withReplicaSet();

    private static final String TYPE = "organizations";
    private static final String AGGREGATE_ID = "org-doc-1";
    private static final String TENANT = "tenant-a";
    private static final String COPIES = "widget_copies";

    private final CopyProjection projection = new CopyProjection();

    @Test
    void aFailedApply_rollsBackItsVersion_soTheRetryAppliesTheEventAgain() {
        projection.failingVersion = 9;
        contextRunner().run(context -> {
            ProjectionRunner runner = context.getBean(ProjectionRunner.class);
            ProjectionVersionRepository versions = context.getBean(ProjectionVersionRepository.class);
            projection.mongoOperations = context.getBean(MongoOperations.class);
            recreateCollections(context);

            // execution
            assertThatThrownBy(() -> runner.process(TYPE, projection, AGGREGATE_ID, record(9)))
                    .isInstanceOf(EventProcessingFailedException.class);

            // verifications
            long storedVersion = versions.findStoredVersion(CopyProjection.NAME, TENANT, AGGREGATE_ID);
            assertThat(storedVersion).isEqualTo(ProjectionVersionRepository.NO_VERSION);
            assertThat(copiedVersion(context)).isNull();
        });
    }

    @Test
    void anOlderEventStillWriting_holdsBackTheNewerOne_soTheNewerValueLandsLast() {
        projection.pausedVersion = 7;
        contextRunner().run(context -> {
            ProjectionRunner runner = context.getBean(ProjectionRunner.class);
            ProjectionVersionRepository versions = context.getBean(ProjectionVersionRepository.class);
            projection.mongoOperations = context.getBean(MongoOperations.class);
            recreateCollections(context);

            // execution
            CompletableFuture<Void> older = CompletableFuture.runAsync(
                    () -> runner.process(TYPE, projection, AGGREGATE_ID, record(7)));
            assertThat(projection.paused.await(10, TimeUnit.SECONDS)).isTrue();
            CompletableFuture<Void> newer = CompletableFuture.runAsync(
                    () -> runner.process(TYPE, projection, AGGREGATE_ID, record(8)));
            Thread.sleep(150);
            projection.resume.countDown();
            older.get(10, TimeUnit.SECONDS);
            newer.get(10, TimeUnit.SECONDS);

            // verifications
            assertThat(copiedVersion(context)).isEqualTo(8L);
            assertThat(versions.findStoredVersion(CopyProjection.NAME, TENANT, AGGREGATE_ID)).isEqualTo(8L);
        });
    }

    private ApplicationContextRunner contextRunner() {
        List<Projection<WidgetEvent, ?>> projections = List.of(projection);
        return new ApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(MongoAutoConfiguration.class, DataMongoAutoConfiguration.class,
                        EventProcessingAutoConfiguration.class))
                .withUserConfiguration(AggregateSpecRegistry.class)
                .withPropertyValues("openframe.events.enabled=true", "spring.mongodb.uri=" + MONGO.getConnectionString(),
                        "spring.mongodb.database=projection_runner_transaction_it")
                .withBean(MeterRegistry.class, SimpleMeterRegistry::new)
                .withBean(WidgetSpec.class, () -> new WidgetSpec(projections));
    }

    // One database for both tests: each starts with empty collections, created here, not inside a transaction.
    private static void recreateCollections(AssertableApplicationContext context) {
        MongoOperations mongoOperations = context.getBean(MongoOperations.class);
        mongoOperations.dropCollection(ProjectionVersion.class);
        mongoOperations.dropCollection(COPIES);
        mongoOperations.createCollection(ProjectionVersion.class);
        mongoOperations.createCollection(COPIES);
    }

    private Long copiedVersion(AssertableApplicationContext context) {
        MongoOperations mongoOperations = context.getBean(MongoOperations.class);
        Document copy = mongoOperations.getCollection(COPIES).find(new Document("_id", AGGREGATE_ID)).first();
        return copy == null ? null : copy.getLong("version");
    }

    private static PublishedRecord<WidgetEvent> record(long version) {
        return PublishedRecord.<WidgetEvent>builder()
                .tenantId(TENANT)
                .version(version)
                .deleted(false)
                .schemaVersion(1)
                .event(new WidgetEvent())
                .build();
    }

    // Copies the event's version into one document; it can fail or pause at a chosen version, before its write.
    static class CopyProjection implements Projection<WidgetEvent, Object> {

        static final String NAME = "widget-copy";

        final CountDownLatch paused = new CountDownLatch(1);
        final CountDownLatch resume = new CountDownLatch(1);
        volatile long failingVersion = -1;
        volatile long pausedVersion = -1;
        volatile MongoOperations mongoOperations;

        @Override
        public String name() {
            return NAME;
        }

        @Override
        public void apply(PublishedRecord<WidgetEvent> record) {
            long version = record.getVersion();
            if (version == failingVersion) {
                throw new IllegalStateException("bug at version " + version);
            }
            if (version == pausedVersion) {
                paused.countDown();
                awaitResume();
            }
            Query query = Query.query(Criteria.where("_id").is(AGGREGATE_ID));
            Update update = new Update().set("version", version);
            mongoOperations.upsert(query, update, COPIES);
        }

        @Override
        public long countChanges(PublishedRecord<WidgetEvent> record, int limit) {
            return 1;
        }

        @Override
        public String applyBatch(PublishedRecord<WidgetEvent> record, String lastId, int batchSize) {
            return null;
        }

        @Override
        public Class<?> projectedClass() {
            return Object.class;
        }

        @Override
        public Class<Object> projectedViewClass() {
            return Object.class;
        }

        @Override
        public ReconciliationResult reconcile(List<Object> projectedItems) {
            return ReconciliationResult.allMatch();
        }

        private void awaitResume() {
            try {
                resume.await(10, TimeUnit.SECONDS);
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
            }
        }
    }
}
