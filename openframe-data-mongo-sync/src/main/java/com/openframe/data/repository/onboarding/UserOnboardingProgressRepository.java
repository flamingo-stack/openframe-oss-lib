package com.openframe.data.repository.onboarding;

import com.openframe.data.document.onboarding.UserOnboardingProgress;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Repository for {@link UserOnboardingProgress} (one per userId + tenantId).
 * <p>
 * Deliberately a plain {@code @Repository} (not {@code @TenantAwareRepository}): the SaaS-side runtime
 * runs with tenant isolation disabled and bypasses the tenant aspect, so callers must pass tenantId
 * explicitly via {@link #findByUserIdAndTenantId(String, String)}.
 */
@Repository
public interface UserOnboardingProgressRepository extends MongoRepository<UserOnboardingProgress, String> {

    Optional<UserOnboardingProgress> findByUserIdAndTenantId(String userId, String tenantId);
}
