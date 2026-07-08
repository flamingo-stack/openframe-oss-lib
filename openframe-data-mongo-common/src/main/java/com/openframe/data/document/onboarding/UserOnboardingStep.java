package com.openframe.data.document.onboarding;

/**
 * Steps of the per-user "Get Started" onboarding flow.
 * One {@link UserOnboardingProgress} record per (userId, tenantId) tracks which of these are done.
 * Order mirrors the Figma design; the UI grouping (Get set up / Run your operations / Work smarter
 * with AI) is presentational only and not persisted.
 */
public enum UserOnboardingStep {
    CUSTOMERS_SETUP,
    DEVICE_MANAGEMENT,
    TICKETS,
    SCRIPTING,
    MONITORING,
    LOGGING,
    KNOWLEDGE_MANAGEMENT,
    MEET_MINGO
}
