package com.openframe.data.integration.support;

import com.openframe.data.repository.rmm.ScriptRepository;
import com.openframe.data.repository.rmm.CustomScriptRepositoryImpl;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.data.mongodb.config.EnableMongoAuditing;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;

/**
 * Minimal Spring boot configuration for RMM repository integration tests.
 *
 * <p>Mirrors {@code IntegrationTestApplication} but restricts repository scanning
 * to the RMM package so unrelated repositories (notifications, organizations, …)
 * do not need to be wired into the test context. Mongo auditing is enabled so
 * that {@code @CreatedDate} / {@code @LastModifiedDate} on {@code Script} are
 * populated by the framework, matching production behaviour.
 *
 * <p>Custom repository fragment implementations are not picked up by
 * {@code @EnableMongoRepositories} alone — Spring Data resolves them as
 * regular beans, so they must be explicitly imported here. In production
 * they are picked up by the tenant app's component scan.
 */
@SpringBootConfiguration
@EnableAutoConfiguration
@EnableMongoAuditing
@EnableMongoRepositories(basePackageClasses = ScriptRepository.class)
@Import({
        CustomScriptRepositoryImpl.class
})
public class RmmIntegrationTestApplication {
}
