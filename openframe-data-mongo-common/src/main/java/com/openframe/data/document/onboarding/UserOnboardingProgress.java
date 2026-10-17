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

// Per-user "Get Started" onboarding progress, independent of the tenant-wide Initial Setup flow.
// The stored completedSteps set is the single source of truth; the flow can be skipped, finished
// explicitly (completed), or reset back to a clean state (no steps, not skipped, not completed).
@Document(collection = "user_onboarding_progress")
@CompoundIndex(name = "user_tenant_unique", def = "{'userId': 1, 'tenantId': 1}", unique = true)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserOnboardingProgress implements TenantScoped {

    @Id
    private String id;

    private String userId;

    private String tenantId;

    // Explicitly-completed steps (add-only, idempotent); the single source of truth for progress.
    @Builder.Default
    private Set<UserOnboardingStep> completedSteps = new LinkedHashSet<>();

    @Builder.Default
    private boolean completed = false;

    private Instant completedAt;

    @Builder.Default
    private boolean skipped = false;

    private Instant skippedAt;
}

