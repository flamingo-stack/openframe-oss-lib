package com.openframe.data.repository.organization;

import com.openframe.data.document.organization.Organization;
import com.openframe.data.document.organization.OrganizationStatus;
import com.openframe.data.repository.organization.publishing.OrganizationSpec;
import com.openframe.publishing.config.OutboxAutoConfiguration;
import com.openframe.publishing.config.OutboxIndexAutoConfiguration;
import com.openframe.publishing.persistence.OutboxEvent;
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
import org.springframework.context.annotation.Import;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mongodb.MongoDBContainer;
import org.testcontainers.utility.DockerImageName;

import static org.assertj.core.api.Assertions.assertThat;

// The real OrganizationRepository, its custom implementation and OrganizationSpec, with the outbox wired as in a service.
@SpringBootTest(classes = OrganizationPublishingIT.TestApplication.class,
        properties = {"openframe.events.topics.organizations.publish=true", "spring.data.mongodb.enabled=true",
                "openframe.events.publishing.enabled=true"})
@Testcontainers
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class OrganizationPublishingIT {

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
    void savingAnOrganization_writesItsEventWithThePublicFieldsOnly() {
        Organization saved = organizationRepository.save(organization("Acme"));

        assertThat(mongoTemplate.findAll(OutboxEvent.class)).singleElement().satisfies(row -> {
            assertThat(row.getAggregateType()).isEqualTo("organizations");
            assertThat(row.getAggregateId()).isEqualTo(saved.getId());
            assertThat(row.getTenantId()).isEqualTo("tenant-1");
            assertThat(row.getVersion()).isZero();
            assertThat(row.getPayload()).containsEntry("name", "Acme").containsEntry("organizationId", "org-1")
                    .doesNotContainKeys("notes", "monthlyRevenue");
        });
    }

    @Test
    void deletingAnOrganization_writesADeletedEvent() {
        Organization saved = organizationRepository.save(organization("Acme"));

        organizationRepository.delete(saved);

        assertThat(mongoTemplate.findAll(OutboxEvent.class)).filteredOn(OutboxEvent::isDeleted).singleElement()
                .satisfies(row -> assertThat(row.getVersion()).isEqualTo(1L));
    }

    @Test
    void archiving_writesAnEventWithTheNewStatusAndVersion() {
        Organization saved = organizationRepository.save(organization("Acme"));
        saved.setStatus(OrganizationStatus.ARCHIVED);

        organizationRepository.save(saved);

        assertThat(mongoTemplate.findAll(OutboxEvent.class)).hasSize(2)
                .anySatisfy(row -> {
                    assertThat(row.getPayload()).containsEntry("status", "ARCHIVED");
                    assertThat(row.getVersion()).isEqualTo(1L);
                });
    }

    @Test
    void theCustomRepositoryMethods_stillRead() {
        organizationRepository.save(organization("Acme"));

        assertThat(organizationRepository.findOrganizationsWithFilters(null, "Acme")).hasSize(1);
    }

    private static Organization organization(String name) {
        return Organization.builder()
                .tenantId("tenant-1")
                .organizationId("org-1")
                .name(name)
                .notes("internal")
                .build();
    }

    // Only what a service gets from these modules: not @EnableAutoConfiguration, which would also load MongoSyncConfig.
    @SpringBootConfiguration
    @ImportAutoConfiguration({MongoAutoConfiguration.class, DataMongoAutoConfiguration.class, OutboxAutoConfiguration.class,
            OutboxIndexAutoConfiguration.class})
    @EnableMongoRepositories(basePackageClasses = OrganizationRepository.class)
    @Import(OrganizationSpec.class)
    static class TestApplication {
    }
}
