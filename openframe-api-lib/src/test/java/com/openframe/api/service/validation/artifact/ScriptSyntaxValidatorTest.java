package com.openframe.api.service.validation.artifact;

import com.openframe.data.document.rmm.ScriptShell;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledOnOs;
import org.junit.jupiter.api.condition.OS;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ScriptSyntaxValidatorTest {

    private final ScriptSyntaxValidator validator = new ScriptSyntaxValidator();

    @Test
    @EnabledOnOs({OS.LINUX, OS.MAC})
    void acceptsValidBash() {
        ArtifactValidationResult r = validator.validate(ScriptShell.BASH,
                "#!/bin/bash\nset -e\necho \"hello\"\n");
        assertFalse(r.blocked());
        assertTrue(r.methods().contains("SYNTAX_BASH_N"));
    }

    @Test
    @EnabledOnOs({OS.LINUX, OS.MAC})
    void rejectsBrokenBash() {
        ArtifactValidationResult r = validator.validate(ScriptShell.BASH,
                "if [ -f /tmp/x ]; then\necho unclosed\n");
        assertTrue(r.blocked());
        assertTrue(r.errorMessages().get(0).contains("syntax"));
    }

    @Test
    @EnabledOnOs({OS.LINUX, OS.MAC})
    void acceptsValidSh() {
        ArtifactValidationResult r = validator.validate(ScriptShell.SHELL,
                "echo hello\n");
        assertFalse(r.blocked());
        assertTrue(r.methods().contains("SYNTAX_SH_N"));
    }

    /**
     * Python is checked only where python3 exists — on a developer machine,
     * never in the service images, which ship no interpreters on purpose.
     * Asserted conditionally so the suite is honest either way: the parser ran
     * and rejected the body, or the check was recorded as skipped — never
     * "silently passed as validated".
     */
    @Test
    void brokenPythonIsRejectedWhenInterpreterAvailable() {
        ArtifactValidationResult r = validator.validate(ScriptShell.PYTHON,
                "def broken(:\n    pass\n");
        if (r.methods().contains("SYNTAX_PYTHON_AST")) {
            assertTrue(r.blocked());
        } else {
            assertTrue(r.methods().contains("SYNTAX_SKIPPED_NO_INTERPRETER"));
        }
    }

    @Test
    void validPythonPasses() {
        ArtifactValidationResult r = validator.validate(ScriptShell.PYTHON,
                "import os\n\ndef main():\n    print(os.getcwd())\n");
        assertFalse(r.blocked());
    }

    @Test
    void powershellIsSkippedNotBlocked() {
        ArtifactValidationResult r = validator.validate(ScriptShell.POWERSHELL,
                "Get-Process | Where-Object { $_.CPU -gt 100 }");
        assertFalse(r.blocked());
        assertTrue(r.methods().contains("SYNTAX_SKIPPED_NO_INTERPRETER"));
    }

    @Test
    void cmdIsSkippedNotBlocked() {
        ArtifactValidationResult r = validator.validate(ScriptShell.CMD, "dir C:\\");
        assertFalse(r.blocked());
        assertTrue(r.methods().contains("SYNTAX_SKIPPED_NO_INTERPRETER"));
    }

    @Test
    void rejectsEmptyBody() {
        assertTrue(validator.validate(ScriptShell.BASH, " ").blocked());
        assertTrue(validator.validate(ScriptShell.BASH, null).blocked());
    }
}
