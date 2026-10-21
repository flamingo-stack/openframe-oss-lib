package com.openframe.event.jobs.repository;

import com.openframe.event.jobs.reconciliation.MappedCopy;
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
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mongodb.MongoDBContainer;
import org.testcontainers.utility.DockerImageName;

import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = ReconciledCopyRepositoryIT.TestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
@Testcontainers
class ReconciledCopyRepositoryIT {

    @Container
    static final MongoDBContainer MONGO = new MongoDBContainer(DockerImageName.parse("mongo:7"));

    @DynamicPropertySource
    static void mongoProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.mongodb.uri", MONGO::getConnectionString);
        registry.add("spring.mongodb.database", () -> "event_jobs_it");
    }

    private static final MappedCopy TICKETS = MappedCopy.builder()
            .name("tickets.organizationName")
            .targetCollection("it_tickets").targetReferenceField("organizationId").targetField("organizationName")
            .sourceCollection("it_organizations").sourceKeyField("organizationId").sourceField("name")
            .build();

    private static final ObjectId FIRST = new ObjectId("652f00000000000000000001");
    private static final ObjectId SECOND = new ObjectId("652f00000000000000000002");
    private static final ObjectId THIRD = new ObjectId("652f00000000000000000003");

    @Autowired
    private MongoTemplate mongoTemplate;

    private ReconciledCopyRepository repository;

    @BeforeEach
    void setUp() {
        mongoTemplate.dropCollection("it_tickets");
        mongoTemplate.dropCollection("it_organizations");
        repository = new ReconciledCopyRepository(mongoTemplate);
        mongoTemplate.insert(List.of(
                ticket(THIRD, "org-1", "Acme"),
                ticket(FIRST, "org-1", "Acme"),
                ticket(SECOND, "org-2", "Beta")), "it_tickets");
        mongoTemplate.insert(List.of(
                new Document("tenantId", "tenant-a").append("organizationId", "org-1").append("name", "Acme").append("other", "x"),
                new Document("tenantId", "tenant-a").append("organizationId", "org-3"),
                new Document("tenantId", "tenant-b").append("organizationId", "org-2").append("name", "Beta")),
                "it_organizations");
    }

    @Test
    void theTargets_comeIn_idOrder_withOnlyTheComparedFields() {
        // execution
        List<Document> targets = repository.findTargetsAfter(TICKETS, null, 2);

        // verifications
        assertThat(targets).extracting(target -> target.get("_id")).containsExactly(FIRST, SECOND);
        assertThat(targets.getFirst().keySet()).containsExactlyInAnyOrder("_id", "tenantId", "organizationId", "organizationName");
    }

    @Test
    void theNextTargets_startAfterTheLastId_givenAsAString() {
        // execution
        List<Document> targets = repository.findTargetsAfter(TICKETS, SECOND.toHexString(), 2);

        // verifications
        assertThat(targets).extracting(target -> target.get("_id")).containsExactly(THIRD);
    }

    @Test
    void theSourceValues_comeByTenant_andAMissingSourceIsAbsent() {
        // execution
        Map<String, Map<String, Object>> values = repository.findSourceValues(TICKETS, Set.of("tenant-a", "tenant-b"),
                Set.of("org-1", "org-2", "org-3", "org-9"));

        // verifications
        assertThat(values).containsOnlyKeys("tenant-a", "tenant-b");
        assertThat(values.get("tenant-a")).containsOnlyKeys("org-1", "org-3").containsEntry("org-1", "Acme");
        assertThat(values.get("tenant-a").get("org-3")).isNull();
        assertThat(values.get("tenant-b")).containsOnlyKeys("org-2").containsEntry("org-2", "Beta");
    }

    @Test
    void theTargets_canBeReadAgainByTheirIds() {
        // execution
        List<Document> targets = repository.findTargetsByIds(TICKETS, List.of(FIRST.toHexString(), THIRD.toHexString()));

        // verifications
        assertThat(targets).extracting(target -> target.get("_id")).containsExactlyInAnyOrder(FIRST, THIRD);
    }

    @Test
    void targetCollectionExists_isFalseForAWrongName() {
        // setup
        MappedCopy wrongName = MappedCopy.builder().name("typo").targetCollection("it_tikets").build();

        // execution
        boolean exists = repository.targetCollectionExists(TICKETS);
        boolean wrongExists = repository.targetCollectionExists(wrongName);

        // verifications
        assertThat(exists).isTrue();
        assertThat(wrongExists).isFalse();
    }

    private static Document ticket(ObjectId id, String organizationId, String organizationName) {
        return new Document("_id", id).append("tenantId", "tenant-a").append("organizationId", organizationId)
                .append("organizationName", organizationName).append("title", "ignored");
    }

    @SpringBootConfiguration
    @EnableAutoConfiguration
    static class TestApplication {
    }
}
