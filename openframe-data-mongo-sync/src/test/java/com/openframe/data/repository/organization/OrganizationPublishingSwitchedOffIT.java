package com.openframe.data.repository.organization;

import com.openframe.data.document.organization.Organization;
import com.openframe.data.document.organization.OrganizationStatus;
import com.openframe.data.repository.organization.publishing.OrganizationSpec;
import com.openframe.publishing.api.OutboxPublisher;
import com.openframe.publishing.config.OutboxAutoConfiguration;
import com.openframe.publishing.config.OutboxIndexAutoConfiguration;
import com.openframe.publishing.persistence.OutboxEvent;
import com.openframe.publishing.persistence.OutboxIndexInitializer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.aop.framework.Advised;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.data.mongodb.autoconfigure.DataMongoAutoConfiguration;
import org.springframework.boot.mongodb.autoconfigure.MongoAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Import;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mongodb.MongoDBContainer;
import org.testcontainers.utility.DockerImageName;

import static org.assertj.core.api.Assertions.assertThat;

// The publishing switch is off while the topic is on: the service runs exactly as before the outbox existed.
@SpringBootTest(classes = OrganizationPublishingSwitchedOffIT.TestApplication.class,
        properties = {"openframe.events.topics.organizations.publish=true", "spring.data.mongodb.enabled=true"})
@Testcontainers
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class OrganizationPublishingSwitchedOffIT {

    @Container
    static final MongoDBContainer MONGO = new MongoDBContainer(DockerImageName.parse("mongo:7")).withReplicaSet();

    @DynamicPropertySource
    static void mongoProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.mongodb.uri", MONGO::getReplicaSetUrl);
    }

    @Autowired private OrganizationRepository organizationRepository;
    @Autowired private MongoTemplate mongoTemplate;
    @Autowired private ApplicationContext context;

    @BeforeEach
    void setUp() {
        mongoTemplate.dropCollection(Organization.class);
        mongoTemplate.dropCollection(OutboxEvent.class);
        mongoTemplate.createCollection(Organization.class);
        mongoTemplate.createCollection(OutboxEvent.class);
    }

    @Test
    void noPublishingBeanExists_andTheRepositoryHasNoInterceptor() {
        assertThat(context.getBeanProvider(OutboxPublisher.class).getIfAvailable()).isNull();
        assertThat(context.getBeanProvider(OutboxIndexInitializer.class).getIfAvailable()).isNull();
        assertThat(organizationRepository).isInstanceOfSatisfying(Advised.class, advised -> assertThat(advised.getAdvisors())
                .noneMatch(advisor -> advisor.getAdvice().getClass().getPackageName().startsWith("com.openframe.publishing")));
    }

    @Test
    void savesAndDeletes_work_andWriteNoOutboxRow() {
        Organization saved = organizationRepository.save(organization("Acme"));
        organizationRepository.save(organization("Globex"));
        saved.setStatus(OrganizationStatus.ARCHIVED);
        organizationRepository.save(saved);

        organizationRepository.deleteById(saved.getId());
        assertThat(organizationRepository.count()).isEqualTo(1);
        organizationRepository.deleteAll();

        assertThat(organizationRepository.count()).isZero();
        assertThat(mongoTemplate.count(new Query(), OutboxEvent.class)).isZero();
    }

    private static Organization organization(String name) {
        return Organization.builder()
                .tenantId("tenant-1")
                .organizationId("org-" + name)
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
