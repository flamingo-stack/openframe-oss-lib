package com.openframe.data.integration.repository.tenant;

import com.mongodb.ReadPreference;
import com.mongodb.client.MongoClient;
import com.openframe.data.document.tenant.Tenant;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.TenantKeyIntegrationTestApplication;
import com.openframe.data.repository.tenant.TenantRepository;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.repository.support.MongoRepositoryFactory;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = TenantKeyIntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class TenantRepositoryIT extends BaseMongoIntegrationTest {

    @Autowired
    private MongoClient mongoClient;

    @Test
    void domainAvailabilityReadsNewlyCreatedWorkspaceFromThePrimary() {
        String databaseName = "tenant-availability-" + UUID.randomUUID();
        CapturingMongoTemplate template = new CapturingMongoTemplate(mongoClient, databaseName);
        template.setReadPreference(ReadPreference.secondaryPreferred());
        TenantRepository repository = new MongoRepositoryFactory(template).getRepository(TenantRepository.class);
        String domain = "new-workspace.example.test";

        try {
            repository.save(Tenant.builder().id("workspace").name("New Workspace").domain(domain).build());
            assertDomainExistsOnPrimary(repository, template, domain);
        } finally {
            template.getDb().drop();
        }
    }

    private void assertDomainExistsOnPrimary(TenantRepository repository, CapturingMongoTemplate template, String domain) {
        assertThat(repository.existsByDomain(domain)).isTrue();
        assertThat(template.domainReadPreference).isEqualTo(ReadPreference.primary());
    }

    private static class CapturingMongoTemplate extends MongoTemplate {

        private ReadPreference domainReadPreference;

        CapturingMongoTemplate(MongoClient client, String databaseName) {
            super(client, databaseName);
        }

        @Override
        public boolean exists(Query query, Class<?> entityClass, String collectionName) {
            domainReadPreference = query.getReadPreference();
            return super.exists(query, entityClass, collectionName);
        }
    }
}
