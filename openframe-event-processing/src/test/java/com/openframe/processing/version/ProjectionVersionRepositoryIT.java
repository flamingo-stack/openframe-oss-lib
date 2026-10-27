package com.openframe.processing.version;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.data.mongodb.autoconfigure.DataMongoAutoConfiguration;
import org.springframework.boot.mongodb.autoconfigure.MongoAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mongodb.MongoDBContainer;
import org.testcontainers.utility.DockerImageName;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = ProjectionVersionRepositoryIT.TestApplication.class)
@Testcontainers
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class ProjectionVersionRepositoryIT {

    @Container
    static final MongoDBContainer MONGO = new MongoDBContainer(DockerImageName.parse("mongo:7"));

    @DynamicPropertySource
    static void mongoProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.mongodb.uri", MONGO::getConnectionString);
        registry.add("spring.mongodb.database", () -> "projection_versions_it");
    }

    private static final String TICKETS = "organization-on-tickets";

    @Autowired private MongoTemplate mongoTemplate;

    private ProjectionVersionRepository repository;

    @BeforeEach
    void setUp() {
        mongoTemplate.dropCollection(ProjectionVersion.class);
        repository = new ProjectionVersionRepository(mongoTemplate);
    }

    @Test
    void anAggregateWithoutAStoredVersion_isBelowVersionZero() {
        // execution
        long version = repository.findStoredVersion(TICKETS, "tenant-a", "org-doc-1");

        // verifications
        assertThat(version).isEqualTo(ProjectionVersionRepository.NO_VERSION);
        assertThat(version).isLessThan(0);
    }

    @Test
    void aStoredVersion_isReadBack_withItsProjectionTenantAndAggregate() {
        // execution
        repository.saveVersionIfHigher(TICKETS, "tenant-a", "org-doc-1", 4);

        // verifications
        assertThat(repository.findStoredVersion(TICKETS, "tenant-a", "org-doc-1")).isEqualTo(4);
        ProjectionVersion stored = mongoTemplate.findById("organization-on-tickets:tenant-a:org-doc-1", ProjectionVersion.class);
        assertThat(stored.getProjection()).isEqualTo(TICKETS);
        assertThat(stored.getTenantId()).isEqualTo("tenant-a");
        assertThat(stored.getAggregateId()).isEqualTo("org-doc-1");
        assertThat(stored.getUpdatedAt()).isNotNull();
    }

    @Test
    void anOlderVersionStoredLater_keepsTheNewerOne() {
        // setup
        repository.saveVersionIfHigher(TICKETS, "tenant-a", "org-doc-1", 7);

        // execution
        repository.saveVersionIfHigher(TICKETS, "tenant-a", "org-doc-1", 5);

        // verifications
        assertThat(repository.findStoredVersion(TICKETS, "tenant-a", "org-doc-1")).isEqualTo(7);
        long documents = mongoTemplate.count(new Query(), ProjectionVersion.class);
        assertThat(documents)
                .isEqualTo(1);
    }

    @Test
    void eachProjectionTenantAndAggregate_hasItsOwnVersion() {
        // execution
        repository.saveVersionIfHigher(TICKETS, "tenant-a", "org-doc-1", 7);
        repository.saveVersionIfHigher("organization-on-index", "tenant-a", "org-doc-1", 2);
        repository.saveVersionIfHigher(TICKETS, "tenant-b", "org-doc-1", 3);
        repository.saveVersionIfHigher(TICKETS, "tenant-a", "org-doc-2", 1);

        // verifications
        assertThat(repository.findStoredVersion(TICKETS, "tenant-a", "org-doc-1")).isEqualTo(7);
        assertThat(repository.findStoredVersion("organization-on-index", "tenant-a", "org-doc-1")).isEqualTo(2);
        assertThat(repository.findStoredVersion(TICKETS, "tenant-b", "org-doc-1")).isEqualTo(3);
        assertThat(repository.findStoredVersion(TICKETS, "tenant-a", "org-doc-2")).isEqualTo(1);
    }

    @SpringBootConfiguration
    @ImportAutoConfiguration({MongoAutoConfiguration.class, DataMongoAutoConfiguration.class})
    static class TestApplication {
    }
}
