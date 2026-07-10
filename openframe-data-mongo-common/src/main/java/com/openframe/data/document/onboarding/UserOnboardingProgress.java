package com.openframe.data.document.onboarding;

import com.openframe.data.document.TenantScoped;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Per-user "Get Started" onboarding progress. One record per (userId, tenantId), independent of the
 * tenant-wide Initial Setup flow.
 * <p>
 * The stored {@code completedSteps} set is the single source of truth. The flow can be skipped at the
 * start or at any time ({@code skipped}), is finished explicitly ({@code completed} via "Finish"), and
 * can be reset back to a clean state (no steps, not skipped, not completed).
 */
@Document(collection = "user_onboarding_progress")
@CompoundIndex(name = "user_tenant_unique", def = "{'userId': 1, 'tenantId': 1}", unique = true)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserOnboardingProgress implements TenantScoped {

    @Id
    private String id;

    /** Owning user. Unique together with {@link #tenantId}. */
    private String userId;

    /** Owning tenant. Unique together with {@link #userId}. */
    private String tenantId;

    /** Explicitly-completed steps (add-only, idempotent). Subset of {@link UserOnboardingStep}. */
    @Builder.Default
    private Set<UserOnboardingStep> completedSteps = new LinkedHashSet<>();

    /** Set only by the explicit "Finish" action. */
    @Builder.Default
    private boolean completed = false;

    /** When {@link #completed} was set; null while not completed. */
    private Instant completedAt;

    /** Set by "Skip Onboarding" (at the start or anytime). Cleared by reset. */
    @Builder.Default
    private boolean skipped = false;

    /** When {@link #skipped} was set; null while not skipped. */
    private Instant skippedAt;
}
