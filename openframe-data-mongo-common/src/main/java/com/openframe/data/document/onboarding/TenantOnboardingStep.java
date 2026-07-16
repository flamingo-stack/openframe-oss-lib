package com.openframe.data.document.onboarding;

/**
 * Steps of the tenant-wide "Initial Setup" onboarding flow.
 * One {@link TenantOnboardingProgress} record per tenant tracks which of these are done.
 * Order mirrors the Figma design.
 */
public enum TenantOnboardingStep {
    MSP_SETUP,
    CUSTOMERS_SETUP,
    DEVICE_MANAGEMENT,
    COMPANY_TEAM
}
