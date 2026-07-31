package com.openframe.data.document.rmm;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

/**
 * Validation gate outcome stamped on a {@link Script} at create/update time.
 *
 * <p>{@code methods} lists exactly which checks ran, including honest skips
 * (e.g. {@code SYNTAX_SKIPPED_NO_INTERPRETER} when the shell has no parser in
 * the container), so a library entry can never look "validated" by a check
 * that never executed.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScriptValidation {
    private Instant validatedAt;
    /** e.g. SYNTAX_BASH_N, STATIC_RULES, SYNTAX_SKIPPED_NO_INTERPRETER */
    private List<String> methods;
    /** Supported platforms at validation time (validation context, not schema). */
    private List<String> targetOs;
    private boolean highImpact;
    /** Non-blocking findings surfaced to the library UI. */
    private List<String> warnings;
    /** Human who approved a high-impact artifact (required when highImpact). */
    private String approvedBy;
    private Instant approvedAt;
}
