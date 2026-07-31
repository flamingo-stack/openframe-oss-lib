package com.openframe.api.service.validation.artifact;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OsquerySqlValidatorTest {

    private final OsquerySqlValidator validator = new OsquerySqlValidator();

    @Test
    void acceptsValidOsquerySelect() {
        // 'processes' doesn't exist in bare sqlite — validator must treat
        // "no such table" as a syntax PASS (schema is osquery-side).
        ArtifactValidationResult r = validator.validate("SELECT pid, name FROM processes WHERE name = 'sshd';");
        assertFalse(r.blocked());
        assertTrue(r.methods().contains("SYNTAX_SQLITE"));
    }

    @Test
    void rejectsBrokenSyntax() {
        ArtifactValidationResult r = validator.validate("SELCT pid FRM processes");
        assertTrue(r.blocked());
    }

    @Test
    void rejectsInvalidSelectBody() {
        ArtifactValidationResult r = validator.validate("SELECT FROM WHERE");
        assertTrue(r.blocked());
        assertTrue(r.errorMessages().get(0).toLowerCase().contains("syntax"));
    }

    @Test
    void rejectsNonSelectStatements() {
        assertTrue(validator.validate("DELETE FROM users").blocked());
        assertTrue(validator.validate("DROP TABLE users").blocked());
        assertTrue(validator.validate("UPDATE users SET uid = 0").blocked());
    }

    @Test
    void rejectsMultipleStatements() {
        assertTrue(validator.validate("SELECT 1; SELECT 2").blocked());
    }

    @Test
    void allowsSemicolonInsideLiteralAndTrailing() {
        assertFalse(validator.validate("SELECT ';' AS s;").blocked());
    }

    @Test
    void acceptsWithCte() {
        ArtifactValidationResult r = validator.validate(
                "WITH u AS (SELECT uid FROM users) SELECT * FROM u");
        assertFalse(r.blocked());
    }

    @Test
    void rejectsBlank() {
        assertTrue(validator.validate("   ").blocked());
        assertTrue(validator.validate(null).blocked());
    }
}
