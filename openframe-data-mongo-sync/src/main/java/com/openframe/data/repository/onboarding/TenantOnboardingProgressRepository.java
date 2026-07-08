package com.openframe.data.repository.onboarding;

import com.openframe.data.document.onboarding.TenantOnboardingProgress;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Repository for {@link TenantOnboardingProgress} (one per tenant).
 * <p>
 * Deliberately a plain {@code @Repository} (not {@code @TenantAwareRepository}): the SaaS-side runtime
 * runs with tenant isolation disabled and bypasses the tenant aspect, so callers must pass tenantId
 * explicitly via {@link #findByTenantId(String)}.
 */
@Repository
public interface TenantOnboardingProgressRepository extends MongoRepository<TenantOnboardingProgress, String> {

    Optional<TenantOnboardingProgress> findByTenantId(String tenantId);
}
