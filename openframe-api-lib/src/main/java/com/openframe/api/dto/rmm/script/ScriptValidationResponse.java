package com.openframe.api.dto.rmm.script;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.List;

/**
 * API representation of the validation gate outcome stored on a script.
 * Null on the parent {@link ScriptResponse} only for scripts created before
 * the validation gate shipped.
 */
@Data
@Builder
public class ScriptValidationResponse {

    private Instant validatedAt;
    /** Checks that actually ran, including honest skips (e.g. SYNTAX_SKIPPED_NO_INTERPRETER). */
    private List<String> methods;
    private List<String> targetOs;
    private boolean highImpact;
    private List<String> warnings;
    private String approvedBy;
    private Instant approvedAt;
}
