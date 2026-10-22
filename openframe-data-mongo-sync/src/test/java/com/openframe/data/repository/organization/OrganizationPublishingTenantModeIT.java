package com.openframe.data.repository.organization;

import com.openframe.data.document.organization.Organization;
import com.openframe.data.mongo.TenantAwareMongoTemplate;
import com.openframe.data.repository.organization.publishing.OrganizationAggregateSpec;
import com.openframe.data.repository.organization.publishing.OrganizationOnTicketsProjection;
import com.openframe.publishing.config.AggregateSpecAutoConfiguration;
import com.openframe.publishing.config.OutboxAutoConfiguration;
import com.openframe.publishing.persistence.OutboxEvent;
import org.bson.Document;
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
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.convert.MongoConverter;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mongodb.MongoDBContainer;
import org.testcontainers.utility.DockerImageName;

import static org.assertj.core.api.Assertions.assertThat;

// Tenant plane: TenantAwareMongoTemplate is the main template, so publishing reads and writes inside the pod's tenant.
@SpringBootTest(classes = OrganizationPublishingTenantModeIT.TestApplication.class,
        properties = {"openframe.events.topics.organizations.publish=true", "spring.data.mongodb.enabled=true",
                "openframe.events.publishing.enabled=true"})
@Testcontainers
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class OrganizationPublishingTenantModeIT {

    private static final String POD_TENANT = "tenant-1";

    @Container
    static final MongoDBContainer MONGO = new MongoDBContainer(DockerImageName.parse("mongo:7")).withReplicaSet();

    @DynamicPropertySource
    static void mongoProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.mongodb.uri", MONGO::getReplicaSetUrl);
    }

    @Autowired private OrganizationRepository organizationRepository;
    @Autowired private MongoTemplate mongoTemplate;

    @BeforeEach
    void setUp() {
        mongoTemplate.dropCollection(Organization.class);
        mongoTemplate.dropCollection(OutboxEvent.class);
        mongoTemplate.createCollection(Organization.class);
        mongoTemplate.createCollection(OutboxEvent.class);
    }

    @Test
    void aSave_writesARowOfThePodsTenant() {
        organizationRepository.save(organization("org-1"));

        assertThat(mongoTemplate.findAll(OutboxEvent.class)).singleElement()
                .satisfies(row -> assertThat(row.getTenantId()).isEqualTo(POD_TENANT));
    }

    @Test
    void deletingAnotherTenantsOrganization_deletesNothing_andPublishesNothing() {
        Document otherTenant = new Document("_id", "other").append("tenantId", "tenant-2")
                .append("organizationId", "org-2").append("name", "Other").append("version", 0L);
        mongoTemplate.getCollection("organizations").insertOne(otherTenant);

        organizationRepository.deleteById("other");

        assertThat(mongoTemplate.getCollection("organizations").countDocuments()).isEqualTo(1);
        assertThat(mongoTemplate.findAll(OutboxEvent.class)).isEmpty();
    }

    @Test
    void deleteAll_deletesOnlyThePodsTenant_andWritesDeleteRowsOnlyForIt() {
        organizationRepository.save(organization("org-1"));
        Document otherTenant = new Document("_id", "other").append("tenantId", "tenant-2")
                .append("organizationId", "org-2").append("name", "Other").append("version", 0L);
        mongoTemplate.getCollection("organizations").insertOne(otherTenant);

        organizationRepository.deleteAll();

        assertThat(mongoTemplate.getCollection("organizations").countDocuments()).isEqualTo(1);
        assertThat(mongoTemplate.findAll(OutboxEvent.class)).filteredOn(OrganizationPublishingTenantModeIT::isDeleteRow).hasSize(2)
                .allSatisfy(row -> assertThat(row.getTenantId()).isEqualTo(POD_TENANT));
    }

    // The delete envelope (deleted in its payload) and the tombstone after it (no payload).
    private static boolean isDeleteRow(OutboxEvent row) {
        return row.getPayload() == null || Boolean.TRUE.equals(row.getPayload().get("deleted"));
    }

    private static Organization organization(String organizationId) {
        return Organization.builder().tenantId(POD_TENANT).organizationId(organizationId).name("Acme").build();
    }

    @SpringBootConfiguration
    @ImportAutoConfiguration({MongoAutoConfiguration.class, DataMongoAutoConfiguration.class, AggregateSpecAutoConfiguration.class, OutboxAutoConfiguration.class})
    @EnableMongoRepositories(basePackageClasses = OrganizationRepository.class)
    @Import({OrganizationAggregateSpec.class, OrganizationOnTicketsProjection.class})
    static class TestApplication {

        @Bean
        @Primary
        MongoTemplate mongoTemplate(MongoDatabaseFactory mongoDatabaseFactory, MongoConverter mongoConverter) {
            return new TenantAwareMongoTemplate(mongoDatabaseFactory, mongoConverter, () -> POD_TENANT);
        }
    }
}
