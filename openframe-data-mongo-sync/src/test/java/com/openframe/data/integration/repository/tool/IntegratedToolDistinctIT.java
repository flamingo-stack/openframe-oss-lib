package com.openframe.data.integration.repository.tool;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.mongo.TenantAwareMongoTemplate;
import com.openframe.data.repository.tool.CustomIntegratedToolRepositoryImpl;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.SimpleMongoClientDatabaseFactory;
import org.springframework.data.mongodb.core.convert.DefaultDbRefResolver;
import org.springframework.data.mongodb.core.convert.MappingMongoConverter;
import org.springframework.data.mongodb.core.mapping.MongoMappingContext;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class IntegratedToolDistinctIT extends BaseMongoIntegrationTest {

    private static final String TENANT_A = "tenant-a";
    private static final String TENANT_B = "tenant-b";

    private static MongoClient client;
    private static MongoTemplate rawTemplate;
    private static CustomIntegratedToolRepositoryImpl repository;

    @BeforeAll
    static void setUp() {
        String uri = System.getProperty("mongo.external.uri");
        if (uri == null) {
            if (!MONGO.isRunning()) {
                MONGO.start();
            }
            uri = MONGO.getConnectionString() + "/?directConnection=true";
        }
        client = MongoClients.create(uri);
        MongoDatabaseFactory factory = new SimpleMongoClientDatabaseFactory(client, "test");
        MappingMongoConverter converter =
                new MappingMongoConverter(new DefaultDbRefResolver(factory), new MongoMappingContext());
        converter.afterPropertiesSet();

        rawTemplate = new MongoTemplate(factory, converter);
        repository = new CustomIntegratedToolRepositoryImpl(
                new TenantAwareMongoTemplate(factory, converter, () -> TENANT_A));
    }

    @AfterAll
    static void tearDown() {
        client.close();
    }

    @BeforeEach
    void resetCollection() {
        rawTemplate.remove(new Query(), IntegratedTool.class);
        rawTemplate.insert(tool(TENANT_A, "INTEGRATION_A", "RMM", "MONITORING"));
        rawTemplate.insert(tool(TENANT_B, "INTEGRATION_B", "PSA", "TICKETING"));
    }

    @Test
    @DisplayName("Given tools in two tenants, when the tool filters are read for tenant A, then only tenant A's types, categories and platform categories come back")
    void distinctFilters_areScopedToCurrentTenant() {
        assertThat(repository.findDistinctTypes()).containsExactly("INTEGRATION_A");
        assertThat(repository.findDistinctCategories()).containsExactly("RMM");
        assertThat(repository.findDistinctPlatformCategories()).containsExactly("MONITORING");
    }

    @Test
    @DisplayName("Given a findDistinct query that already names a tenant, when it runs through the template, then the caller's tenantId is kept rather than overridden")
    void findDistinct_keepsExplicitTenantCriteria() {
        TenantAwareMongoTemplate template = new TenantAwareMongoTemplate(
                rawTemplate.getMongoDatabaseFactory(), rawTemplate.getConverter(), () -> TENANT_A);

        Query forTenantB = new Query(Criteria.where("tenantId").is(TENANT_B));

        assertThat(template.findDistinct(forTenantB, "type", IntegratedTool.class, String.class))
                .containsExactly("INTEGRATION_B");
    }

    private static IntegratedTool tool(String tenantId, String type, String category, String platformCategory) {
        return IntegratedTool.builder()
                .id(UUID.randomUUID().toString())
                .tenantId(tenantId)
                .key(type.toLowerCase())
                .name(type)
                .type(type)
                .category(category)
                .platformCategory(platformCategory)
                .enabled(true)
                .build();
    }
}
