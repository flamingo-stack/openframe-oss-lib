package com.openframe.data.document.onboarding;

/**
 * Steps of the per-user "Get Started" onboarding flow.
 * One {@link UserOnboardingProgress} record per (userId, tenantId) tracks which of these are done.
 * Order mirrors the Figma design; the UI grouping (Work smarter with AI / Run your operations) is
 * presentational only and not persisted.
 */
public enum UserOnboardingStep {
    MEET_MINGO,
    TICKETS,
    SCRIPTING,
    MONITORING,
    LOGGING,
    KNOWLEDGE_MANAGEMENT
}
