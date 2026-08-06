package com.openframe.api.service.validation.artifact;

import org.springframework.stereotype.Component;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.List;
import java.util.Locale;

/**
 * Syntax gate for osquery SQL (policies, scheduled queries, live queries).
 *
 * <p>osquery speaks the SQLite dialect, so the artifact is compiled against an
 * in-memory SQLite database. Bare SQLite has none of osquery's virtual tables,
 * therefore "no such table/column/function" compile errors are treated as a
 * syntax PASS with a warning (table/column existence is proven by running the
 * query on a machine the technician approved, not by this gate). osquery is
 * read-only: anything that is not a single SELECT/WITH statement is rejected
 * outright.
 */
@Component
public class OsquerySqlValidator {

    private static final String METHOD = "SYNTAX_SQLITE";

    public ArtifactValidationResult validate(String sql) {
        if (sql == null || sql.isBlank()) {
            return error("SQL_EMPTY", "query must not be empty");
        }
        String trimmed = sql.trim();

        String upper = trimmed.toUpperCase(Locale.ROOT);
        if (!upper.startsWith("SELECT") && !upper.startsWith("WITH")) {
            return error("SQL_NOT_SELECT",
                    "osquery artifacts must be a single read-only SELECT (or WITH ... SELECT) statement");
        }
        if (upper.startsWith("WITH") && !statementAfterCteIsSelect(trimmed)) {
            // SQLite allows WITH before DELETE/INSERT/UPDATE; without this check such a
            // statement reaches sqlite, fails with "no such table" (the tables live in
            // osquery, not here), and would be waved through as an unverified-schema warning.
            return error("SQL_NOT_SELECT",
                    "osquery artifacts must be a single read-only SELECT (or WITH ... SELECT) statement");
        }
        if (containsMultipleStatements(trimmed)) {
            return error("SQL_MULTIPLE_STATEMENTS", "exactly one SQL statement is allowed");
        }

        try (Connection conn = DriverManager.getConnection("jdbc:sqlite::memory:")) {
            conn.prepareStatement(trimmed).close();
        } catch (SQLException e) {
            String msg = e.getMessage() == null ? "unknown SQL error" : e.getMessage();
            String lower = msg.toLowerCase(Locale.ROOT);
            if (lower.contains("no such table") || lower.contains("no such column")
                    || lower.contains("no such function")) {
                // Schema/function unknown to bare sqlite — the syntax itself parsed fine.
                return new ArtifactValidationResult(
                        List.of(new ValidationFinding(ValidationSeverity.WARNING,
                                "SQL_UNVERIFIED_SCHEMA",
                                "syntax is valid; sqlite cannot verify the osquery schema ("
                                        + msg + ") — run the query on a machine to confirm it returns data")),
                        List.of(METHOD));
            }
            return error("SQL_SYNTAX", "SQL syntax error: " + msg);
        }
        return new ArtifactValidationResult(List.of(), List.of(METHOD));
    }

    /**
     * Walks past the CTE list of a {@code WITH} statement and reports whether the
     * statement it introduces is a SELECT. Quote- and paren-aware, so commas and
     * keywords inside a CTE body or a string literal do not confuse it.
     */
    private boolean statementAfterCteIsSelect(String sql) {
        boolean inSingle = false;
        boolean inDouble = false;
        int depth = 0;
        int i = "WITH".length();
        // The CTE list is `name AS ( ... )` groups separated by commas at depth 0.
        while (i < sql.length()) {
            char c = sql.charAt(i);
            if (c == '\'' && !inDouble) {
                inSingle = !inSingle;
            } else if (c == '"' && !inSingle) {
                inDouble = !inDouble;
            } else if (!inSingle && !inDouble) {
                if (c == '(') {
                    depth++;
                } else if (c == ')') {
                    depth--;
                    if (depth == 0) {
                        int next = skipWhitespace(sql, i + 1);
                        if (next >= sql.length()) {
                            return false;
                        }
                        // a comma means another CTE follows — keep scanning;
                        // anything else is the statement the WITH introduces
                        if (sql.charAt(next) != ',') {
                            return sql.substring(next).toUpperCase(Locale.ROOT).startsWith("SELECT");
                        }
                        i = next - 1;
                    }
                }
            }
            i++;
        }
        return false;
    }

    private int skipWhitespace(String sql, int from) {
        int i = from;
        while (i < sql.length() && Character.isWhitespace(sql.charAt(i))) {
            i++;
        }
        return i;
    }

    /** Detects a ';' outside string literals that is followed by more SQL (a single trailing ';' is fine). */
    private boolean containsMultipleStatements(String sql) {
        boolean inSingle = false;
        boolean inDouble = false;
        for (int i = 0; i < sql.length(); i++) {
            char c = sql.charAt(i);
            if (c == '\'' && !inDouble) {
                inSingle = !inSingle;
            } else if (c == '"' && !inSingle) {
                inDouble = !inDouble;
            } else if (c == ';' && !inSingle && !inDouble && !sql.substring(i + 1).isBlank()) {
                return true;
            }
        }
        return false;
    }

    private ArtifactValidationResult error(String code, String message) {
        return new ArtifactValidationResult(
                List.of(new ValidationFinding(ValidationSeverity.ERROR, code, message)),
                List.of(METHOD));
    }
}
