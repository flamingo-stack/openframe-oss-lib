package com.openframe.data.config;

import com.openframe.data.document.rmm.osupdate.DeviceOsState;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.RmmIntegrationTestApplication;
import com.openframe.data.repository.rmm.osupdate.CustomDeviceOsStateRepositoryImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.IndexInfo;
import org.springframework.data.mongodb.core.index.MongoPersistentEntityIndexResolver;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

@SpringBootTest(classes = RmmIntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class MongoIndexConfigDeviceOsStateIT extends BaseMongoIntegrationTest {

    private static final String COLLECTION = "device_os_states";
    private static final String TENANT_ID = "tenant-1";
    private static final String MACHINE_ID = "machine-1";
    private static final Instant NEWER = Instant.parse("2026-11-19T10:15:02.417Z");
    private static final Instant OLDER = Instant.parse("2026-11-19T10:14:51Z");

    @Autowired private MongoTemplate mongoTemplate;

    private MongoIndexConfig config;
    private CustomDeviceOsStateRepositoryImpl repository;

    @BeforeEach
    void setUp() {
        mongoTemplate.dropCollection(COLLECTION);
        config = new MongoIndexConfig();
        ReflectionTestUtils.setField(config, "mongoTemplate", mongoTemplate);
        repository = new CustomDeviceOsStateRepositoryImpl(mongoTemplate);
    }

    @Test
    void initIndexes_stateCollectionWithoutTheIndexOfTheDocument_olderReportLosesToTheStoredNewerOne() {
        // setup
        config.initIndexes();
        repository.upsertUnlessNewerStored(stateReceivedAt(NEWER, "26100.4061"));

        // execution
        boolean applied = repository.upsertUnlessNewerStored(stateReceivedAt(OLDER, "26100.3915"));

        // verifications
        assertThat(applied).isFalse();
        assertThat(mongoTemplate.findAll(DeviceOsState.class, COLLECTION))
                .extracting(DeviceOsState::getReceivedAt, DeviceOsState::getOsBuild)
                .containsExactly(tuple(NEWER, "26100.4061"));
    }

    @Test
    void initIndexes_indexOfTheDocumentAlreadyCreated_sameIndexAndNoConflict() {
        // setup
        new MongoPersistentEntityIndexResolver(mongoTemplate.getConverter().getMappingContext())
                .resolveIndexFor(DeviceOsState.class)
                .forEach(mongoTemplate.indexOps(COLLECTION)::createIndex);

        // execution
        config.initIndexes();

        // verifications
        assertThat(uniqueIndexNames()).containsExactly("tenant_machine");
    }

    private List<String> uniqueIndexNames() {
        return mongoTemplate.indexOps(COLLECTION).getIndexInfo().stream()
                .filter(IndexInfo::isUnique)
                .map(IndexInfo::getName)
                .toList();
    }

    private static DeviceOsState stateReceivedAt(Instant receivedAt, String osBuild) {
        return DeviceOsState.builder()
                .tenantId(TENANT_ID)
                .machineId(MACHINE_ID)
                .osBuild(osBuild)
                .receivedAt(receivedAt)
                .build();
    }
}
