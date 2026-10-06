package com.openframe.test.data.dto.onboarding;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

// The signed-in user's Get Started progress for the current tenant; completedSteps has no order guarantee.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class UserOnboardingProgress {
    private List<String> completedSteps;
    private Boolean completed;
    private Instant completedAt;
    private Boolean skipped;
    private Instant skippedAt;
}
