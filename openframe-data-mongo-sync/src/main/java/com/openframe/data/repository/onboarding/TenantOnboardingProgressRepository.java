package com.openframe.data.repository.onboarding;

import com.openframe.data.document.onboarding.TenantOnboardingProgress;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

// Plain @Repository (not @TenantAwareRepository): SaaS-side runtime disables tenant isolation, so callers must pass tenantId explicitly.
@Repository
public interface TenantOnboardingProgressRepository extends MongoRepository<TenantOnboardingProgress, String> {

    Optional<TenantOnboardingProgress> findByTenantId(String tenantId);
}

