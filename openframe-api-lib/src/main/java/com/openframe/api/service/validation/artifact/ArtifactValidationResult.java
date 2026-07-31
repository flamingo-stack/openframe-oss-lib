package com.openframe.api.service.validation.artifact;

import java.util.ArrayList;
import java.util.List;

/**
 * Outcome of running one or more validators over an artifact.
 *
 * <p>{@code methods} records WHICH checks actually ran (e.g. SYNTAX_SQLITE,
 * SYNTAX_BASH_N, STATIC_RULES, SYNTAX_SKIPPED_NO_INTERPRETER) so the stored
 * metadata is honest about skipped checks — an artifact can never look
 * "validated" by a check that never executed.
 */
public record ArtifactValidationResult(List<ValidationFinding> findings, List<String> methods) {

    public boolean blocked() {
        return findings.stream().anyMatch(f -> f.severity() == ValidationSeverity.ERROR);
    }

    public boolean highImpact() {
        return findings.stream().anyMatch(f -> f.severity() == ValidationSeverity.HIGH_IMPACT);
    }

    public List<String> errorMessages() {
        return findings.stream()
                .filter(f -> f.severity() == ValidationSeverity.ERROR)
                .map(ValidationFinding::message)
                .toList();
    }

    /** Non-blocking findings (HIGH_IMPACT and WARNING), formatted for storage. */
    public List<String> warningMessages() {
        return findings.stream()
                .filter(f -> f.severity() != ValidationSeverity.ERROR)
                .map(f -> f.code() + ": " + f.message())
                .toList();
    }

    public static ArtifactValidationResult merge(ArtifactValidationResult... results) {
        List<ValidationFinding> findings = new ArrayList<>();
        List<String> methods = new ArrayList<>();
        for (ArtifactValidationResult r : results) {
            findings.addAll(r.findings());
            methods.addAll(r.methods());
        }
        return new ArtifactValidationResult(List.copyOf(findings), List.copyOf(methods));
    }
}
