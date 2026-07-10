package com.openframe.data.document.onboarding;

import com.openframe.data.document.TenantScoped;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Tenant-wide "Initial Setup" onboarding progress. Exactly one record per tenant, shared across all
 * admins — whoever finishes it finishes it for the whole tenant.
 * <p>
 * The stored {@code completedSteps} set is the single source of truth: nothing is inferred at read
 * time. The flow cannot be skipped; {@code completed} is set only by the explicit "Complete" action
 * and is the tenant's definitive "onboarded" marker.
 */
@Document(collection = "tenant_onboarding_progress")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TenantOnboardingProgress implements TenantScoped {

    @Id
    private String id;

    /** Owning tenant. One record per tenant. */
    @Indexed(unique = true)
    private String tenantId;

    /** Explicitly-completed steps (add-only, idempotent). Subset of {@link TenantOnboardingStep}. */
    @Builder.Default
    private Set<TenantOnboardingStep> completedSteps = new LinkedHashSet<>();

    /** Set only by the explicit "Complete" action. */
    @Builder.Default
    private boolean completed = false;

    /** When {@link #completed} was set; null while not completed. */
    private Instant completedAt;
}
