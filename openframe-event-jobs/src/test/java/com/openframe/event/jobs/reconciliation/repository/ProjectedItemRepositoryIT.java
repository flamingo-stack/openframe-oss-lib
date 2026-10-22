package com.openframe.event.jobs.reconciliation.repository;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mongodb.MongoDBContainer;
import org.testcontainers.utility.DockerImageName;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = ProjectedItemRepositoryIT.TestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
@Testcontainers
class ProjectedItemRepositoryIT {

    @Container
    static final MongoDBContainer MONGO = new MongoDBContainer(DockerImageName.parse("mongo:7"));

    @DynamicPropertySource
    static void mongoProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.mongodb.uri", MONGO::getConnectionString);
        registry.add("spring.mongodb.database", () -> "event_jobs_it");
    }

    private static final String FIRST = new ObjectId("652f00000000000000000001").toHexString();
    private static final String SECOND = new ObjectId("652f00000000000000000002").toHexString();
    private static final String THIRD = new ObjectId("652f00000000000000000003").toHexString();

    @Autowired
    private MongoTemplate mongoTemplate;

    private ProjectedItemRepository repository;

    @BeforeEach
    void setUp() {
        mongoTemplate.dropCollection(Item.class);
        mongoTemplate.dropCollection(Missing.class);
        repository = new ProjectedItemRepository(mongoTemplate);
        mongoTemplate.insertAll(List.of(new Item(THIRD, "Gamma", "s3"), new Item(FIRST, "Alpha", "s1"), new Item(SECOND, "Beta", "s2")));
    }

    @Test
    void theItems_comeIn_idOrder_asTheViewClass() {
        // execution
        List<ItemView> items = repository.findAfter(Item.class, ItemView.class, null, 2);

        // verifications
        assertThat(items).extracting(ItemView::getId).containsExactly(FIRST, SECOND);
        assertThat(items.getFirst().getName()).isEqualTo("Alpha");
    }

    @Test
    void onlyTheViewClassesFields_areRead() {
        // setup
        Document profileAll = new Document("profile", 2);
        mongoTemplate.getDb().runCommand(profileAll);

        // execution
        repository.findAfter(Item.class, ItemView.class, null, 2);

        // verifications
        Query itemFinds = Query.query(Criteria.where("ns").is("event_jobs_it.it_items").and("command.find").is("it_items"));
        Document find = mongoTemplate.findOne(itemFinds, Document.class, "system.profile");
        Document projection = find.get("command", Document.class).get("projection", Document.class);
        assertThat(projection.keySet()).containsExactlyInAnyOrder("_id", "name");
    }

    @Test
    void theNextItems_startAfterTheLastId_storedAsAnObjectId() {
        // execution
        List<ItemView> items = repository.findAfter(Item.class, ItemView.class, SECOND, 2);

        // verifications
        assertThat(items).extracting(ItemView::getId).containsExactly(THIRD);
    }

    @Test
    void theItems_canBeReadAgainByTheirIds() {
        // execution
        List<ItemView> items = repository.findByIds(Item.class, ItemView.class, List.of(FIRST, THIRD));

        // verifications
        assertThat(items).extracting(ItemView::getId).containsExactlyInAnyOrder(FIRST, THIRD);
    }

    @Test
    void idOf_isTheItemsIdAsAString() {
        // setup
        ItemView item = repository.findAfter(Item.class, ItemView.class, null, 1).getFirst();

        // execution
        String id = repository.idOf(item);

        // verifications
        assertThat(id).isEqualTo(FIRST);
    }

    @Test
    void collectionExists_isFalseForAClassWithoutDocuments() {
        // execution
        boolean exists = repository.collectionExists(Item.class);
        boolean missingExists = repository.collectionExists(Missing.class);

        // verifications
        assertThat(exists).isTrue();
        assertThat(missingExists).isFalse();
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @org.springframework.data.mongodb.core.mapping.Document("it_items")
    static class Item {
        @Id
        private String id;
        private String name;
        private String secret;
    }

    @Data
    @NoArgsConstructor
    static class ItemView {
        @Id
        private String id;
        private String name;
    }

    @Data
    @org.springframework.data.mongodb.core.mapping.Document("it_missing")
    static class Missing {
        @Id
        private String id;
    }

    @SpringBootConfiguration
    @EnableAutoConfiguration
    static class TestApplication {
    }
}
