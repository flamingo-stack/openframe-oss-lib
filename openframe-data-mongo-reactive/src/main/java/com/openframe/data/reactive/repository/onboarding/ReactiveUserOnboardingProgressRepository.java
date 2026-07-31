package com.openframe.data.reactive.repository.onboarding;

import com.openframe.data.document.onboarding.UserOnboardingProgress;
import org.springframework.data.mongodb.repository.ReactiveMongoRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Mono;

/**
 * Reactive view of {@code user_onboarding_progress}, for the WebFlux gateway. Mirrors the blocking
 * {@code UserOnboardingProgressRepository} in openframe-data-mongo-sync.
 * <p>
 * Not tenant-aware: the shared/SaaS runtime bypasses the tenant aspect, so tenantId is passed
 * explicitly on every query.
 */
@Repository
public interface ReactiveUserOnboardingProgressRepository extends ReactiveMongoRepository<UserOnboardingProgress, String> {

    Mono<UserOnboardingProgress> findByUserIdAndTenantId(String userId, String tenantId);
}
