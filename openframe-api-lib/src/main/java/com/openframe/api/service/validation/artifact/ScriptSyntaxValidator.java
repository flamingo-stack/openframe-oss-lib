package com.openframe.api.service.validation.artifact;

import com.openframe.data.document.rmm.ScriptShell;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/**
 * Parse-only syntax gate for saved RMM scripts.
 *
 * <p>Delegates to the shell's own parser where one exists in the container
 * ({@code bash -n} / {@code sh -n} / python {@code ast.parse}); the body is fed
 * through stdin and nothing is ever executed — no file is written and no state
 * is left behind.
 *
 * <p>Only a failure to launch the interpreter counts as
 * {@code SYNTAX_SKIPPED_NO_INTERPRETER}. Anything else that goes wrong (broken
 * pipe, timeout, interruption) is reported as an ERROR finding: the check did
 * not happen, and metadata must never imply that it did.
 *
 * <p>Deployment note: the OpenFrame service images deliberately ship WITHOUT
 * these interpreters, so in production every shell takes the skip path. A
 * script is proven by running it on a machine the technician approved — see the
 * library-save rules in the agent's system prompt — not by parsing it here.
 * Adding bash/python to a service image is what turns this validator on again;
 * do that only as a deliberate decision, not as a "missing dependency" fix.
 */
@Slf4j
@Component
public class ScriptSyntaxValidator {

    private static final String METHOD_SKIPPED = "SYNTAX_SKIPPED_NO_INTERPRETER";
    private static final int TIMEOUT_SECONDS = 10;
    private static final int OUTPUT_DRAIN_SECONDS = 2;
    private static final int MAX_OUTPUT_CHARS = 2000;

    public ArtifactValidationResult validate(ScriptShell shell, String body) {
        if (body == null || body.isBlank()) {
            return error("SCRIPT_EMPTY", "scriptBody must not be empty", List.of());
        }
        return switch (shell) {
            case BASH -> parse("SYNTAX_BASH_N", body, "bash", "-n");
            case SHELL -> parse("SYNTAX_SH_N", body, "sh", "-n");
            case PYTHON -> parse("SYNTAX_PYTHON_AST", body,
                    "python3", "-c", "import sys, ast; ast.parse(sys.stdin.read())");
            case POWERSHELL, CMD, NUSHELL -> skipped();
        };
    }

    /**
     * Runs the interpreter's parser over the body supplied on stdin. stdout is
     * drained on a separate thread so that a parser which never exits cannot
     * block the caller: the deadline applies to the process, not to the read.
     */
    private ArtifactValidationResult parse(String method, String body, String... command) {
        Process process;
        try {
            process = new ProcessBuilder(command).redirectErrorStream(true).start();
        } catch (IOException e) {
            // The binary is not in this image — the honest, non-blocking outcome.
            log.info("Interpreter unavailable for {} ({}), recording skip", method, e.getMessage());
            return skipped();
        }

        CompletableFuture<String> output = CompletableFuture.supplyAsync(() -> read(process.getInputStream()));
        try {
            try (OutputStream stdin = process.getOutputStream()) {
                stdin.write(body.getBytes(StandardCharsets.UTF_8));
            }
            if (!process.waitFor(TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
                process.destroyForcibly();
                return checkFailed(method, "syntax check timed out after " + TIMEOUT_SECONDS + "s");
            }
            String text = output.get(OUTPUT_DRAIN_SECONDS, TimeUnit.SECONDS).trim();
            if (process.exitValue() != 0) {
                return new ArtifactValidationResult(
                        List.of(new ValidationFinding(ValidationSeverity.ERROR, "SCRIPT_SYNTAX",
                                "script syntax check failed: " + truncate(text))),
                        List.of(method));
            }
            return new ArtifactValidationResult(List.of(), List.of(method));
        } catch (IOException | ExecutionException | TimeoutException e) {
            process.destroyForcibly();
            return checkFailed(method, "syntax check could not complete: " + e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            process.destroyForcibly();
            return checkFailed(method, "syntax check was interrupted");
        }
    }

    private static String read(InputStream in) {
        try (in) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            return "";
        }
    }

    private static String truncate(String text) {
        return text.length() <= MAX_OUTPUT_CHARS ? text : text.substring(0, MAX_OUTPUT_CHARS) + " […]";
    }

    /**
     * The interpreter was there but the check did not finish — block the save
     * rather than record a skip that would read as "nothing to check here".
     */
    private ArtifactValidationResult checkFailed(String method, String message) {
        log.warn("Script syntax check failed to run for {}: {}", method, message);
        return error("SCRIPT_SYNTAX_CHECK_FAILED", message, List.of(method));
    }

    private ArtifactValidationResult error(String code, String message, List<String> methods) {
        return new ArtifactValidationResult(
                List.of(new ValidationFinding(ValidationSeverity.ERROR, code, message)), methods);
    }

    private ArtifactValidationResult skipped() {
        return new ArtifactValidationResult(List.of(), List.of(METHOD_SKIPPED));
    }
}
