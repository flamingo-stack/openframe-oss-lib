package com.openframe.data.integration.support;

import com.openframe.data.repository.oauth.MongoOAuth2AuthorizationRepository;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;

/**
 * Minimal Spring Boot configuration for the OAuth authorization repository integration tests.
 * Repository scanning is restricted to the oauth package so unrelated repositories do not need wiring.
 */
@SpringBootConfiguration
@EnableAutoConfiguration
@EnableMongoRepositories(basePackageClasses = MongoOAuth2AuthorizationRepository.class)
public class OAuthAuthorizationIntegrationTestApplication {
}
