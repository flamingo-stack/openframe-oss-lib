package com.openframe.data.config;

import com.mongodb.client.MongoClient;
import com.openframe.data.document.oauth.MongoOAuth2Authorization;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.OAuthAuthorizationIntegrationTestApplication;
import org.junit.jupiter.api.AfterEach;
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
import org.springframework.data.mongodb.core.index.IndexOperations;
import org.springframework.data.mongodb.core.index.PartialIndexFilter;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = OAuthAuthorizationIntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class OAuthAuthorizationIndexesIT extends BaseMongoIntegrationTest {

    private static final String ACCESS_TOKEN_VALUE = "accessTokenValue";

    @Autowired
    private MongoClient mongoClient;

    private MongoTemplate mongoTemplate;
    private MongoIndexConfig configuration;

    @BeforeEach
    void setUp() {
        mongoTemplate = new MongoTemplate(mongoClient, "oauth-index-" + UUID.randomUUID());
        configuration = new MongoIndexConfig();
        ReflectionTestUtils.setField(configuration, "mongoTemplate", mongoTemplate);
    }

    @AfterEach
    void dropTestDatabase() {
        mongoTemplate.getDb().drop();
    }

    @Test
    void shouldEnsureAnUnfilteredAccessTokenIndexWhenOnlyAPartialIndexExists() {
        IndexOperations indexes = mongoTemplate.indexOps(MongoOAuth2Authorization.class);
        indexes.createIndex(new Index().on(ACCESS_TOKEN_VALUE, Sort.Direction.ASC).named("partial_token")
                .partial(PartialIndexFilter.of(Criteria.where("tenantId").is("tenant-1"))));

        configuration.start();
        configuration.start();

        assertThat(indexes.getIndexInfo()).filteredOn(index -> ACCESS_TOKEN_VALUE.equals(index.getIndexFields().getFirst().getKey()))
                .extracting(IndexInfo::getName).containsExactlyInAnyOrder("partial_token", ACCESS_TOKEN_VALUE);
    }

    @Test
    void shouldKeepAnExistingUnfilteredIndexThatStartsWithTheAccessToken() {
        IndexOperations indexes = mongoTemplate.indexOps(MongoOAuth2Authorization.class);
        indexes.createIndex(new Index().on(ACCESS_TOKEN_VALUE, Sort.Direction.ASC)
                .on("tenantId", Sort.Direction.ASC).named("existing_token"));

        configuration.start();

        assertThat(indexes.getIndexInfo()).filteredOn(index -> ACCESS_TOKEN_VALUE.equals(index.getIndexFields().getFirst().getKey()))
                .extracting(IndexInfo::getName).containsExactly("existing_token");
    }
}
