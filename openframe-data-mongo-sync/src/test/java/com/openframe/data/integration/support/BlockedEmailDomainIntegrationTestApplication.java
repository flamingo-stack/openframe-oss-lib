package com.openframe.data.integration.support;

import com.openframe.data.repository.email.BlockedEmailDomainRepository;
import com.openframe.data.repository.email.StoredBlockedEmailDomainSource;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;

/**
 * Minimal Spring Boot configuration for the blocked email domain integration tests: the email repository package
 * and the source that reads it, nothing else.
 */
@SpringBootConfiguration
@EnableAutoConfiguration
@EnableMongoRepositories(basePackageClasses = BlockedEmailDomainRepository.class)
@Import(StoredBlockedEmailDomainSource.class)
public class BlockedEmailDomainIntegrationTestApplication {
}
