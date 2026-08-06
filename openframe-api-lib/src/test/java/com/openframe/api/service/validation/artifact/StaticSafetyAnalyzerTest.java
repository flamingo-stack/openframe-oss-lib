package com.openframe.api.service.validation.artifact;

import com.openframe.data.document.rmm.ScriptShell;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class StaticSafetyAnalyzerTest {

    private final StaticSafetyAnalyzer analyzer = new StaticSafetyAnalyzer();

    @Test
    void blocksRootDeletion() {
        assertTrue(analyzer.analyzeScript(ScriptShell.BASH, "rm -rf /").blocked());
        assertTrue(analyzer.analyzeScript(ScriptShell.BASH, "rm -rf /*").blocked());
        assertTrue(analyzer.analyzeScript(ScriptShell.POWERSHELL,
                "Remove-Item -Recurse -Force C:\\").blocked());
    }

    @Test
    void blocksRootDeletionWithNoPreserveRootFlag() {
        assertTrue(analyzer.analyzeScript(ScriptShell.BASH, "rm -rf --no-preserve-root /").blocked());
        assertTrue(analyzer.analyzeScript(ScriptShell.BASH, "rm --no-preserve-root -rf /").blocked());
    }

    @Test
    void allowsScopedDeletion() {
        assertFalse(analyzer.analyzeScript(ScriptShell.BASH,
                "set -e\nrm -rf /tmp/build-cache\n").blocked());
        assertFalse(analyzer.analyzeScript(ScriptShell.POWERSHELL,
                "Remove-Item -Recurse -Force C:\\Temp\\cache").blocked());
    }

    @Test
    void blocksDiskDestruction() {
        assertTrue(analyzer.analyzeScript(ScriptShell.BASH, "dd if=/dev/zero of=/dev/sda").blocked());
        assertTrue(analyzer.analyzeScript(ScriptShell.BASH, "mkfs.ext4 /dev/sda1").blocked());
        assertTrue(analyzer.analyzeScript(ScriptShell.CMD, "format C: /q").blocked());
        assertTrue(analyzer.analyzeScript(ScriptShell.BASH, ":(){ :|:& };:").blocked());
    }

    @Test
    void flagsHardcodedCredentialsAsHighImpact() {
        ArtifactValidationResult r = analyzer.analyzeScript(ScriptShell.POWERSHELL,
                "$user = \"admin\"\n$password = \"Sup3rS3cret!\"");
        assertFalse(r.blocked());
        assertTrue(r.highImpact());
    }

    @Test
    void flagsRebootAndServiceStopAsHighImpact() {
        assertTrue(analyzer.analyzeScript(ScriptShell.BASH, "shutdown -r now").highImpact());
        assertTrue(analyzer.analyzeScript(ScriptShell.POWERSHELL, "Restart-Computer -Force").highImpact());
        assertTrue(analyzer.analyzeScript(ScriptShell.POWERSHELL, "Stop-Service -Name WinDefend").highImpact());
        assertTrue(analyzer.analyzeScript(ScriptShell.BASH, "systemctl stop sshd").highImpact());
    }

    @Test
    void doesNotFlagWordsEmbeddedInIdentifiers() {
        // "Restart-Service" is not "Stop-Service"; "rebooted" appears mid-word.
        ArtifactValidationResult r = analyzer.analyzeScript(ScriptShell.POWERSHELL,
                "Restart-Service -Name spooler");
        assertFalse(r.blocked());
        assertFalse(r.highImpact());
    }

    @Test
    void warnsOnMissingErrorHandlingInBash() {
        ArtifactValidationResult r = analyzer.analyzeScript(ScriptShell.BASH, "echo hi\ncp a b\n");
        assertFalse(r.blocked());
        assertFalse(r.highImpact());
        assertTrue(r.warningMessages().stream().anyMatch(w -> w.contains("set -e")));
    }

    @Test
    void cleanScriptPasses() {
        ArtifactValidationResult r = analyzer.analyzeScript(ScriptShell.BASH,
                "#!/bin/bash\nset -euo pipefail\ndf -h\n");
        assertFalse(r.blocked());
        assertFalse(r.highImpact());
    }

    @Test
    void sqlAnalyzerFlagsOnlyCredentials() {
        assertFalse(analyzer.analyzeSql("SELECT * FROM processes").blocked());
        assertTrue(analyzer.analyzeSql(
                "SELECT * FROM curl WHERE url = 'https://x' AND user_agent = 'a' AND token='abcdef123'")
                .highImpact());
    }
}
