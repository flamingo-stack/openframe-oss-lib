package com.openframe.data.config;

import com.openframe.data.document.rmm.software.DeviceSoftware;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.RmmIntegrationTestApplication;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.CompoundIndexDefinition;
import org.springframework.data.mongodb.core.index.IndexInfo;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = RmmIntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class MongoIndexConfigDeviceSoftwareIT extends BaseMongoIntegrationTest {

    private static final String COLLECTION = "device_software";

    @Autowired private MongoTemplate mongoTemplate;

    private MongoIndexConfig config;

    @BeforeEach
    void setUp() {
        mongoTemplate.dropCollection(DeviceSoftware.class);
        mongoTemplate.indexOps(DeviceSoftware.class).createIndex(
                new CompoundIndexDefinition(
                        new Document("tenantId", 1).append("softwareTitleId", 1)).named("tenant_title"));
        mongoTemplate.indexOps(DeviceSoftware.class).createIndex(
                new CompoundIndexDefinition(
                        new Document("tenantId", 1).append("vulnerabilities", 1)).named("tenant_vuln"));
        mongoTemplate.indexOps(DeviceSoftware.class).createIndex(
                new CompoundIndexDefinition(
                        new Document("tenantId", 1).append("softwareTitleId", 1).append("machineConnected", 1)
                                .append("machineId", 1)).named("tenant_title_connected"));
        config = new MongoIndexConfig();
        ReflectionTestUtils.setField(config, "mongoTemplate", mongoTemplate);
    }

    @Test
    void initIndexes_dropsTheReplacedDeviceSoftwareIndexes_keepsTheNewOnes() {
        config.initIndexes();

        assertThat(indexNames()).doesNotContain("tenant_title", "tenant_vuln").contains("tenant_title_connected");
    }

    @Test
    void initIndexes_twice_doesNotFailWhenTheIndexesAreAlreadyGone() {
        config.initIndexes();
        config.initIndexes();

        assertThat(indexNames()).doesNotContain("tenant_title", "tenant_vuln");
    }

    private List<String> indexNames() {
        return mongoTemplate.indexOps(COLLECTION).getIndexInfo().stream().map(IndexInfo::getName).toList();
    }
}
