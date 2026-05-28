package com.openframe.data.integration.support;

import com.openframe.data.repository.rmm.ScriptRepository;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.data.mongodb.config.EnableMongoAuditing;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;

/**
 * Minimal Spring boot configuration for RMM repository integration tests.
 *
 * <p>Mirrors {@link IntegrationTestApplication} but restricts repository scanning
 * to the RMM package so unrelated repositories (notifications, organizations, …)
 * do not need to be wired into the test context. Mongo auditing is enabled so
 * that {@code @CreatedDate} / {@code @LastModifiedDate} on {@code Script} are
 * populated by the framework, matching production behaviour.
 */
@SpringBootConfiguration
@EnableAutoConfiguration
@EnableMongoAuditing
@EnableMongoRepositories(basePackageClasses = ScriptRepository.class)
public class RmmIntegrationTestApplication {
}
