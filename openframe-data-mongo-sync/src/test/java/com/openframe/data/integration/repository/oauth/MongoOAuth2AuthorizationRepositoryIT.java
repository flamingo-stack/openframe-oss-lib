package com.openframe.data.integration.repository.oauth;

import com.openframe.data.document.oauth.MongoOAuth2Authorization;
import com.openframe.data.document.oauth.RetiredRefreshToken;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.OAuthAuthorizationIntegrationTestApplication;
import com.openframe.data.repository.oauth.MongoOAuth2AuthorizationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = OAuthAuthorizationIntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class MongoOAuth2AuthorizationRepositoryIT extends BaseMongoIntegrationTest {

    @Autowired
    private MongoOAuth2AuthorizationRepository repository;

    @Autowired
    private MongoTemplate mongoTemplate;

    @BeforeEach
    void resetCollection() {
        mongoTemplate.remove(new Query(), MongoOAuth2Authorization.class);
    }

    @Test
    void findsAnAuthorizationByAnyOfItsRetiredRefreshTokens() {
        Instant retiredAt = Instant.now().truncatedTo(ChronoUnit.MILLIS);
        MongoOAuth2Authorization authorization = new MongoOAuth2Authorization();
        authorization.setId("authorization-1");
        authorization.setRefreshTokenValue("current");
        authorization.setRetiredRefreshTokens(List.of(
                new RetiredRefreshToken("first", retiredAt),
                new RetiredRefreshToken("second", retiredAt)));
        repository.save(authorization);

        assertThat(repository.findByRetiredRefreshTokensValue("second"))
                .hasValueSatisfying(found -> {
                    assertThat(found.getId()).isEqualTo("authorization-1");
                    assertThat(found.getRetiredRefreshTokens())
                            .containsExactly(new RetiredRefreshToken("first", retiredAt),
                                    new RetiredRefreshToken("second", retiredAt));
                });
        assertThat(repository.findByRetiredRefreshTokensValue("current")).isEmpty();
    }

    @Test
    void createsTheSparseRetiredTokenIndex() {
        assertThat(mongoTemplate.indexOps(MongoOAuth2Authorization.class).getIndexInfo())
                .anySatisfy(index -> {
                    assertThat(index.getName()).isEqualTo("oauth2_authorizations_retired_refresh_token");
                    assertThat(index.isSparse()).isTrue();
                });
    }
}
