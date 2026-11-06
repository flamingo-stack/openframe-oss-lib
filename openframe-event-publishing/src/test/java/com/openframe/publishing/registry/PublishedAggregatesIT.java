package com.openframe.publishing.registry;

import com.openframe.publishing.fixture.Widgets.Widget;
import com.openframe.publishing.fixture.Widgets.WidgetSpec;
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
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mongodb.MongoDBContainer;
import org.testcontainers.utility.DockerImageName;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = PublishedAggregatesIT.TestApplication.class,
        properties = {"openframe.events.topics.organizations.enabled=true", "spring.data.mongodb.enabled=true",
                "openframe.events.enabled=true"})
@Testcontainers
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class PublishedAggregatesIT {

    // publishCurrent writes in a transaction, which needs a replica set.
    @Container
    static final MongoDBContainer MONGO = new MongoDBContainer(DockerImageName.parse("mongo:7")).withReplicaSet();

    @DynamicPropertySource
    static void mongoProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.mongodb.uri", MONGO::getReplicaSetUrl);
    }

    private static final String TYPE = "organizations";

    @Autowired
    private PublishedAggregates publishedAggregates;

    @Autowired
    private MongoTemplate mongoTemplate;

    private List<Widget> widgets;

    @BeforeEach
    void setUp() {
        mongoTemplate.dropCollection(Widget.class);
        mongoTemplate.dropCollection(OutboxEvent.class);
        mongoTemplate.createCollection(Widget.class);
        mongoTemplate.createCollection(OutboxEvent.class);
        widgets = new ArrayList<>();
        for (int index = 0; index < 3; index++) {
            Widget widget = new Widget(null, "tenant-1", "widget-" + index, null, null);
            Widget saved = mongoTemplate.insert(widget);
            widgets.add(saved);
        }
    }

    @Test
    void idsAfter_returnsTheNextIds_inIdOrder() {
        // setup
        String firstId = widgets.getFirst().getId();

        // execution
        List<String> fromStart = publishedAggregates.idsAfter(TYPE, null, 2);
        List<String> afterFirst = publishedAggregates.idsAfter(TYPE, firstId, 5);

        // verifications
        assertThat(fromStart).containsExactly(widgets.get(0).getId(), widgets.get(1).getId());
        assertThat(afterFirst).containsExactly(widgets.get(1).getId(), widgets.get(2).getId());
    }

    @Test
    void publishCurrent_writesARowPerDocument_andReturnsTheirVersions() {
        // setup
        List<String> ids = List.of(widgets.get(0).getId(), widgets.get(1).getId());

        // execution
        Map<String, Long> versions = publishedAggregates.publishCurrent(TYPE, ids);

        // verifications
        assertThat(versions).containsOnlyKeys(ids);
        assertThat(versions.values()).containsOnly(0L);
        List<OutboxEvent> rows = mongoTemplate.findAll(OutboxEvent.class);
        assertThat(rows).extracting(OutboxEvent::getAggregateId).containsExactlyInAnyOrderElementsOf(ids);
        assertThat(rows).extracting(PublishedAggregatesIT::versionOf).containsOnly(0L);
    }

    @Test
    void changedSince_namesTheDocumentsWrittenAfterThePublish() {
        // setup
        Widget changed = widgets.getFirst();
        List<String> ids = List.of(changed.getId(), widgets.get(1).getId());
        Map<String, Long> published = publishedAggregates.publishCurrent(TYPE, ids);
        changed.setName("renamed");
        mongoTemplate.save(changed);

        // execution
        List<String> changedIds = publishedAggregates.changedSince(TYPE, published);

        // verifications
        assertThat(changedIds).containsExactly(changed.getId());
    }

    @Test
    void aTypeWithASpecAndPublishOn_isPublishing() {
        // execution
        boolean publishing = publishedAggregates.isPublishing(TYPE);

        // verifications
        assertThat(publishing).isTrue();
    }

    private static long versionOf(OutboxEvent row) {
        Number version = (Number) row.getPayload().get("version");
        return version.longValue();
    }

    // The repository whose writes publish; the backfill itself reads through the template.
    @SpringBootConfiguration
    @EnableAutoConfiguration
    @EnableMongoRepositories(basePackageClasses = PublishedAggregatesIT.class, considerNestedRepositories = true,
            includeFilters = @Filter(type = FilterType.ASSIGNABLE_TYPE, classes = WidgetStore.class))
    @Import(WidgetSpec.class)
    static class TestApplication {
    }

    interface WidgetStore extends MongoRepository<Widget, String> {
    }
}
