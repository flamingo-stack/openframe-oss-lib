package com.openframe.data.config;

import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateHistoryEntry;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.RmmIntegrationTestApplication;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.index.IndexInfo;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.util.Date;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = RmmIntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class MongoIndexConfigOsUpdateHistoryIT extends BaseMongoIntegrationTest {

    private static final String TTL_INDEX = "device_os_update_history_ttl";

    @Autowired private MongoTemplate mongoTemplate;

    private MongoIndexConfig config;

    @BeforeEach
    void setUp() {
        mongoTemplate.dropCollection(DeviceOsUpdateHistoryEntry.class);
        config = new MongoIndexConfig();
        ReflectionTestUtils.setField(config, "mongoTemplate", mongoTemplate);
    }

    @Test
    void initIndexes_ttlIndexExistsWithThirtyDays_changedToNinetyDaysAndDocumentsKept() {
        mongoTemplate.indexOps(DeviceOsUpdateHistoryEntry.class).createIndex(
                new Index().on("installedAt", Sort.Direction.ASC).expire(Duration.ofDays(30)).named(TTL_INDEX));
        mongoTemplate.insert(new Document("installedAt", new Date()), collection());

        config.initIndexes();

        assertThat(ttlIndex().getExpireAfter()).contains(Duration.ofDays(90));
        assertThat(mongoTemplate.getCollection(collection()).countDocuments()).isEqualTo(1);
    }

    @Test
    void initIndexes_twice_secondRunKeepsNinetyDays() {
        config.initIndexes();
        config.initIndexes();

        assertThat(ttlIndex().getExpireAfter()).contains(Duration.ofDays(90));
    }

    @Test
    void initIndexes_noTtlIndex_createdWithNinetyDays() {
        config.initIndexes();

        assertThat(ttlIndex().getExpireAfter()).contains(Duration.ofDays(90));
    }

    private IndexInfo ttlIndex() {
        return mongoTemplate.indexOps(collection()).getIndexInfo().stream()
                .filter(indexInfo -> TTL_INDEX.equals(indexInfo.getName()))
                .findFirst().orElseThrow();
    }

    private String collection() {
        return mongoTemplate.getCollectionName(DeviceOsUpdateHistoryEntry.class);
    }
}
