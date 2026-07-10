package com.openframe.data.integration.support;

import com.openframe.data.repository.organization.CustomOrganizationRepositoryImpl;
import com.openframe.data.repository.organization.OrganizationRepository;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;

/**
 * Minimal Spring Boot configuration for Organization repository integration
 * tests. Repository scanning is restricted to the organization package so
 * unrelated repositories do not need wiring.
 *
 * <p>Mongo auditing is intentionally NOT enabled here: {@code updatedAt} carries
 * {@code @LastModifiedDate}, and the pagination / range-filter tests must
 * control that value precisely. With auditing off, the value is persisted
 * verbatim rather than overwritten with "now" on save.
 *
 * <p>The custom repository fragment implementation is not picked up by
 * {@code @EnableMongoRepositories} alone, so it is imported explicitly (mirrors
 * {@code RmmIntegrationTestApplication}).
 */
@SpringBootConfiguration
@EnableAutoConfiguration
@EnableMongoRepositories(basePackageClasses = OrganizationRepository.class)
@Import({
        CustomOrganizationRepositoryImpl.class
})
public class OrganizationIntegrationTestApplication {
}
