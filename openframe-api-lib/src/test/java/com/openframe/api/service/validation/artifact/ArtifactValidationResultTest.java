package com.openframe.api.service.validation.artifact;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ArtifactValidationResultTest {

    @Test
    void blockedOnlyWhenErrorFindingPresent() {
        ArtifactValidationResult ok = new ArtifactValidationResult(
                List.of(new ValidationFinding(ValidationSeverity.WARNING, "W1", "warn")),
                List.of("STATIC_RULES"));
        ArtifactValidationResult bad = new ArtifactValidationResult(
                List.of(new ValidationFinding(ValidationSeverity.ERROR, "SQL_SYNTAX", "boom")),
                List.of("SYNTAX_SQLITE"));

        assertFalse(ok.blocked());
        assertTrue(bad.blocked());
        assertEquals(List.of("boom"), bad.errorMessages());
    }

    @Test
    void highImpactFlagAndMerge() {
        ArtifactValidationResult a = new ArtifactValidationResult(
                List.of(new ValidationFinding(ValidationSeverity.HIGH_IMPACT, "CREDENTIALS", "hardcoded secret")),
                List.of("STATIC_RULES"));
        ArtifactValidationResult b = new ArtifactValidationResult(List.of(), List.of("SYNTAX_BASH_N"));

        ArtifactValidationResult merged = ArtifactValidationResult.merge(a, b);
        assertTrue(merged.highImpact());
        assertFalse(merged.blocked());
        assertEquals(List.of("STATIC_RULES", "SYNTAX_BASH_N"), merged.methods());
    }
}
