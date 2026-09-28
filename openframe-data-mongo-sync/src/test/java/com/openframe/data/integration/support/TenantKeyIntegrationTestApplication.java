package com.openframe.data.integration.support;

import com.openframe.data.repository.tenant.TenantKeyRepository;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;

/**
 * Minimal Spring Boot configuration for TenantKey repository integration tests.
 * Repository scanning is restricted to the tenant package so unrelated
 * repositories do not need wiring.
 */
@SpringBootConfiguration
@EnableAutoConfiguration
@EnableMongoRepositories(basePackageClasses = TenantKeyRepository.class)
public class TenantKeyIntegrationTestApplication {
}
