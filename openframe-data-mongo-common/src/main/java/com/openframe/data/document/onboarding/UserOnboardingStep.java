package com.openframe.data.document.onboarding;

/**
 * Steps of the per-user "Get Started" onboarding flow.
 * One {@link UserOnboardingProgress} record per (userId, tenantId) tracks which of these are done.
 * Order mirrors the Getting Started block of the AI-first onboarding (Devices … Knowledge Management); the UI
 * grouping is presentational only and not persisted. {@link #MEET_MINGO} is kept for the older
 * {@code /onboarding} page, which the frontend still shows while the {@code onboarding-v2} flag is off.
 */
public enum UserOnboardingStep {
    MEET_MINGO,
    DEVICES,
    TICKETS,
    SCRIPTING,
    MONITORING,
    LOGGING,
    INCIDENTS,
    KNOWLEDGE_MANAGEMENT
}
