package com.openframe.data.repository.onboarding;

import com.openframe.data.document.onboarding.UserOnboardingProgress;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

// Deliberately a plain @Repository (not @TenantAwareRepository): SaaS-side runtime disables tenant isolation, so callers must pass tenantId explicitly.
@Repository
public interface UserOnboardingProgressRepository extends MongoRepository<UserOnboardingProgress, String> {

    Optional<UserOnboardingProgress> findByUserIdAndTenantId(String userId, String tenantId);
}

