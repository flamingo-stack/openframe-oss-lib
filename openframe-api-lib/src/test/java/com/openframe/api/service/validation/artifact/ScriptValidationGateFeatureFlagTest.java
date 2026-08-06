package com.openframe.api.service.validation.artifact;

import com.openframe.core.exception.ArtifactValidationException;
import com.openframe.data.document.rmm.OsType;
import com.openframe.data.document.rmm.ScriptShell;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * The kill switch: with the feature disabled a script that the gate would
 * normally refuse must save exactly as it did before the gate existed — no
 * exception, and no validation metadata claiming a check that never ran.
 */
class ScriptValidationGateFeatureFlagTest {

    private static final String DESTRUCTIVE = "set -e\nrm -rf /";

    private final ScriptValidationGate disabled = new ScriptValidationGate(
            new ScriptSyntaxValidator(), new StaticSafetyAnalyzer(), false);
    private final ScriptValidationGate enabled = new ScriptValidationGate(
            new ScriptSyntaxValidator(), new StaticSafetyAnalyzer(), true);

    @Test
    void disabledGateLetsDestructiveScriptThroughWithoutMetadata() {
        assertNull(disabled.validateOrThrow(ScriptShell.BASH, DESTRUCTIVE, List.of(OsType.MAC_OS), "user-1"));
    }

    @Test
    void disabledGateSkipsTheHighImpactApprovalRequirement() {
        assertNull(disabled.validateOrThrow(ScriptShell.POWERSHELL, "Restart-Computer -Force",
                List.of(OsType.WINDOWS), "AI_AGENT"));
    }

    @Test
    void enabledGateStillRejectsTheSameScript() {
        assertThrows(ArtifactValidationException.class, () -> enabled.validateOrThrow(
                ScriptShell.BASH, DESTRUCTIVE, List.of(OsType.MAC_OS), "user-1"));
    }
}
