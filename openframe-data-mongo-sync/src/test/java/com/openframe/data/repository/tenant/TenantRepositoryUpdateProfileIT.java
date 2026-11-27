package com.openframe.data.repository.tenant;

import com.openframe.data.document.tenant.Tenant;
import com.openframe.data.integration.BaseMongoIntegrationTest;
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
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = TenantRepositoryUpdateProfileIT.TestApp.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class TenantRepositoryUpdateProfileIT extends BaseMongoIntegrationTest {

    private static final LocalDateTime NOW = LocalDateTime.of(2026, 11, 26, 10, 0);

    @Autowired private MongoTemplate mongoTemplate;
    @Autowired private TenantRepository repository;

    @BeforeEach
    void clean() {
        mongoTemplate.getCollection("tenants").deleteMany(new Document());
    }

    @Test
    void updateProfile_objectIdTenant_setsNameWebsiteAndUpdatedAtOnly() {
        ObjectId id = new ObjectId();
        mongoTemplate.getCollection("tenants").insertOne(new Document("_id", id).append("name", "Old")
                .append("domain", "acme").append("status", "ACTIVE")
                .append("unknownToThisLib", "kept"));

        long matched = repository.updateProfile(id.toHexString(), "Acme", "https://acme.example", NOW);

        Document tenant = mongoTemplate.getCollection("tenants").find(new Document("_id", id)).first();
        assertThat(matched).isEqualTo(1);
        assertThat(tenant).containsEntry("name", "Acme").containsEntry("website", "https://acme.example")
                .containsEntry("domain", "acme")
                .containsEntry("status", "ACTIVE").containsEntry("unknownToThisLib", "kept")
                .containsKey("updatedAt");
    }

    @Test
    void updateProfile_stringIdTenant_isFoundToo() {
        mongoTemplate.getCollection("tenants").insertOne(new Document("_id", "8f14e45f-ceea-467a-9575-0f2d4c4a8b1e")
                .append("name", "Old").append("website", "https://old.example"));

        long matched = repository.updateProfile("8f14e45f-ceea-467a-9575-0f2d4c4a8b1e", "Globex", null, NOW);

        Tenant tenant = repository.findById("8f14e45f-ceea-467a-9575-0f2d4c4a8b1e").orElseThrow();
        assertThat(matched).isEqualTo(1);
        assertThat(tenant.getName()).isEqualTo("Globex");
        assertThat(tenant.getWebsite()).isNull();
    }

    @Test
    void updateProfile_unknownTenant_matchesNothing() {
        assertThat(repository.updateProfile(new ObjectId().toHexString(), "Acme", null, NOW)).isZero();
    }

    @SpringBootConfiguration
    @EnableAutoConfiguration
    @EnableMongoRepositories(basePackageClasses = TenantRepository.class,
            includeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = TenantRepository.class))
    static class TestApp {
    }
}
