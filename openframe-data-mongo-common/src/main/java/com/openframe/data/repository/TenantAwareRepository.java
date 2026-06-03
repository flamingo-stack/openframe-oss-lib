package com.openframe.data.repository;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import org.springframework.stereotype.Repository;

/**
 * Composed annotation for tenant-side Spring Data repository interfaces.
 * Combines @Repository (registers the interface as a Spring component)
 * with a marker for shared-service exclusion.
 *
 * Repositories annotated with this are only valid in contexts where
 * TenantAwareMongoTemplate is available (tenant-isolation.enabled=true).
 *
 * Shared services exclude them via:
 *   @EnableMongoRepositories(
 *       excludeFilters = @ComponentScan.Filter(type = FilterType.ANNOTATION, classes = TenantAwareRepository.class)
 *   )
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Repository
public @interface TenantAwareRepository {
}
