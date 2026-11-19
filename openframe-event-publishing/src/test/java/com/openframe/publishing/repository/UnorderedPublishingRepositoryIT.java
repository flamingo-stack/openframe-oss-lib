package com.openframe.publishing.repository;

import com.openframe.publishing.fixture.Widgets.UnorderedWidgetSpec;
import com.openframe.publishing.fixture.Widgets.UnversionedWidget;
import com.openframe.publishing.persistence.OutboxEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.ComponentScan.Filter;
import org.springframework.context.annotation.FilterType;
import org.springframework.context.annotation.Import;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mongodb.MongoDBContainer;
import org.testcontainers.utility.DockerImageName;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

// A document without @Version published as UNORDERED, through its real repository proxy and real Mongo transactions.
@SpringBootTest(classes = UnorderedPublishingRepositoryIT.TestApplication.class,
        properties = {"openframe.events.topics.organizations.enabled=true", "spring.data.mongodb.enabled=true",
                "openframe.events.enabled=true"})
@Testcontainers
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class UnorderedPublishingRepositoryIT {

    private static final String TAG_ID = "tag-1";

    @Container
    static final MongoDBContainer MONGO = new MongoDBContainer(DockerImageName.parse("mongo:7")).withReplicaSet();

    @DynamicPropertySource
    static void mongoProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.mongodb.uri", MONGO::getReplicaSetUrl);
    }

    @Autowired private UnorderedWidgetRepository repository;
    @Autowired private MongoTemplate mongoTemplate;

    @BeforeEach
    void setUp() {
        mongoTemplate.dropCollection(UnversionedWidget.class);
        mongoTemplate.dropCollection(OutboxEvent.class);
        mongoTemplate.createCollection(UnversionedWidget.class);
        mongoTemplate.createCollection(OutboxEvent.class);
    }

    @Test
    void save_writesTheDocumentAndOneRowWithVersionZero() {
        // setup
        UnversionedWidget tag = new UnversionedWidget(TAG_ID, "Printers");

        // execution
        repository.save(tag);

        // verifications
        assertThat(repository.findById(TAG_ID)).isPresent();
        assertThat(outboxRows())
                .extracting(OutboxEvent::getAggregateType, OutboxEvent::getAggregateId, UnorderedPublishingRepositoryIT::versionOf,
                        UnorderedPublishingRepositoryIT::isDeleted)
                .containsExactly(tuple("organizations", TAG_ID, 0L, false));
    }

    @Test
    void aSecondSave_writesVersionZeroAgain() {
        // setup
        repository.save(new UnversionedWidget(TAG_ID, "Printers"));

        // execution
        repository.save(new UnversionedWidget(TAG_ID, "Scanners"));

        // verifications
        assertThat(outboxRows())
                .extracting(UnorderedPublishingRepositoryIT::versionOf)
                .containsExactly(0L, 0L);
    }

    @Test
    void delete_writesTheDeleteEnvelopeWithVersionZero_thenATombstone() {
        // setup
        UnversionedWidget tag = repository.save(new UnversionedWidget(TAG_ID, "Printers"));
        mongoTemplate.dropCollection(OutboxEvent.class);
        mongoTemplate.createCollection(OutboxEvent.class);

        // execution
        repository.delete(tag);

        // verifications
        assertThat(repository.findById(TAG_ID)).isEmpty();
        assertDeleteAndTombstoneRows();
    }

    @Test
    void deleteById_writesTheDeleteEnvelopeWithVersionZero_thenATombstone() {
        // setup
        repository.save(new UnversionedWidget(TAG_ID, "Printers"));
        mongoTemplate.dropCollection(OutboxEvent.class);
        mongoTemplate.createCollection(OutboxEvent.class);

        // execution
        repository.deleteById(TAG_ID);

        // verifications
        assertThat(repository.findById(TAG_ID)).isEmpty();
        assertDeleteAndTombstoneRows();
    }

    private void assertDeleteAndTombstoneRows() {
        List<OutboxEvent> rows = outboxRows();
        assertThat(rows).hasSize(2).allSatisfy(row -> assertThat(row.getAggregateId()).isEqualTo(TAG_ID));
        OutboxEvent deleteRow = rows.getFirst();
        assertThat(deleteRow.getPayload()).containsEntry("deleted", true).containsEntry("event", null);
        assertThat(versionOf(deleteRow)).isZero();
        assertThat(rows.getLast().getPayload()).isNull();
    }

    private List<OutboxEvent> outboxRows() {
        return mongoTemplate.findAll(OutboxEvent.class);
    }

    private static long versionOf(OutboxEvent row) {
        Number version = (Number) row.getPayload().get("version");
        return version.longValue();
    }

    private static boolean isDeleted(OutboxEvent row) {
        return Boolean.TRUE.equals(row.getPayload().get("deleted"));
    }

    @SpringBootConfiguration
    @EnableAutoConfiguration
    @EnableMongoRepositories(basePackageClasses = UnorderedPublishingRepositoryIT.class, considerNestedRepositories = true,
            includeFilters = @Filter(type = FilterType.ASSIGNABLE_TYPE, classes = UnorderedWidgetRepository.class))
    @Import(UnorderedWidgetSpec.class)
    static class TestApplication {
    }
}
