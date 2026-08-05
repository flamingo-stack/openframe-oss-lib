package com.openframe.api.service.validation.artifact;

import com.openframe.core.exception.ArtifactValidationException;
import com.openframe.data.document.rmm.OsType;
import com.openframe.data.document.rmm.ScriptShell;
import com.openframe.data.document.rmm.ScriptValidation;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledOnOs;
import org.junit.jupiter.api.condition.OS;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ScriptValidationGateTest {

    private final ScriptValidationGate gate = new ScriptValidationGate(
            new ScriptSyntaxValidator(), new StaticSafetyAnalyzer());

    @Test
    @EnabledOnOs({OS.LINUX, OS.MAC})
    void rejectsBrokenBashWithSpecificError() {
        ArtifactValidationException ex = assertThrows(ArtifactValidationException.class,
                () -> gate.validateOrThrow(ScriptShell.BASH, "if [ 1 ]; then\necho x\n",
                        List.of(OsType.MAC_OS), "user-1"));
        assertTrue(ex.getMessage().contains("syntax"));
    }

    @Test
    void rejectsDestructiveScriptRegardlessOfActor() {
        assertThrows(ArtifactValidationException.class,
                () -> gate.validateOrThrow(ScriptShell.BASH, "set -e\nrm -rf /",
                        List.of(OsType.MAC_OS), "user-1"));
    }

    @Test
    void highImpactWithHumanActorSavesWithApprovalRecorded() {
        ScriptValidation v = gate.validateOrThrow(ScriptShell.POWERSHELL,
                "Restart-Computer -Force", List.of(OsType.WINDOWS), "admin-42");
        assertTrue(v.isHighImpact());
        assertEquals("admin-42", v.getApprovedBy());
        assertNotNull(v.getApprovedAt());
    }

    @Test
    void highImpactWithAiAgentSentinelIsRejected() {
        ArtifactValidationException ex = assertThrows(ArtifactValidationException.class,
                () -> gate.validateOrThrow(ScriptShell.POWERSHELL,
                        "Restart-Computer -Force", List.of(OsType.WINDOWS), "AI_AGENT"));
        assertTrue(ex.getMessage().contains("human approval"));
    }

    @Test
    void cleanScriptGetsStampedMetadata() {
        ScriptValidation v = gate.validateOrThrow(ScriptShell.POWERSHELL,
                "Get-Process", List.of(OsType.WINDOWS), "user-1");
        assertNotNull(v.getValidatedAt());
        assertEquals(List.of("WINDOWS"), v.getTargetOs());
        assertFalse(v.isHighImpact());
        assertTrue(v.getMethods().contains("STATIC_RULES"));
        assertEquals(null, v.getApprovedBy());
    }
}
