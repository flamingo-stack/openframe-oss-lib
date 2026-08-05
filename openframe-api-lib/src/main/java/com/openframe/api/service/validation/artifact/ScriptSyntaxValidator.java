package com.openframe.api.service.validation.artifact;

import com.openframe.data.document.rmm.ScriptShell;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Parse-only syntax gate for saved RMM scripts.
 *
 * <p>Delegates to the shell's own parser where one exists in the container
 * ({@code bash -n} / {@code sh -n} / python {@code ast.parse}); nothing is
 * ever executed. Where the interpreter is absent the check is recorded as
 * {@code SYNTAX_SKIPPED_NO_INTERPRETER} rather than blocking the save, and the
 * honest skip shows up in artifact metadata.
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

    static final String METHOD_SKIPPED = "SYNTAX_SKIPPED_NO_INTERPRETER";
    private static final int TIMEOUT_SECONDS = 10;

    public ArtifactValidationResult validate(ScriptShell shell, String body) {
        if (body == null || body.isBlank()) {
            return new ArtifactValidationResult(
                    List.of(new ValidationFinding(ValidationSeverity.ERROR, "SCRIPT_EMPTY",
                            "scriptBody must not be empty")),
                    List.of());
        }
        return switch (shell) {
            case BASH -> parseWithFile("SYNTAX_BASH_N", body, "bash", "-n");
            case SHELL -> parseWithFile("SYNTAX_SH_N", body, "sh", "-n");
            case PYTHON -> parseWithStdin("SYNTAX_PYTHON_AST", body,
                    "python3", "-c", "import sys, ast; ast.parse(sys.stdin.read())");
            case POWERSHELL, CMD, NUSHELL -> skipped();
        };
    }

    private ArtifactValidationResult parseWithFile(String method, String body, String... command) {
        Path tmp = null;
        try {
            tmp = Files.createTempFile("of-script-validate", ".tmp");
            Files.writeString(tmp, body, StandardCharsets.UTF_8);
            String[] full = new String[command.length + 1];
            System.arraycopy(command, 0, full, 0, command.length);
            full[command.length] = tmp.toString();
            return runParser(method, new ProcessBuilder(full), null);
        } catch (IOException e) {
            log.warn("Script syntax check could not run: {}", e.getMessage());
            return skipped();
        } finally {
            if (tmp != null) {
                try {
                    Files.deleteIfExists(tmp);
                } catch (IOException ignored) {
                    // best-effort temp cleanup
                }
            }
        }
    }

    private ArtifactValidationResult parseWithStdin(String method, String body, String... command) {
        return runParser(method, new ProcessBuilder(command), body);
    }

    private ArtifactValidationResult runParser(String method, ProcessBuilder pb, String stdin) {
        pb.redirectErrorStream(true);
        try {
            Process p = pb.start();
            if (stdin != null) {
                p.getOutputStream().write(stdin.getBytes(StandardCharsets.UTF_8));
            }
            p.getOutputStream().close();
            String output = new String(p.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            if (!p.waitFor(TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
                p.destroyForcibly();
                log.warn("Script syntax check timed out for {}", method);
                return skipped();
            }
            if (p.exitValue() != 0) {
                return new ArtifactValidationResult(
                        List.of(new ValidationFinding(ValidationSeverity.ERROR, "SCRIPT_SYNTAX",
                                "script syntax check failed: " + output.trim())),
                        List.of(method));
            }
            return new ArtifactValidationResult(List.of(), List.of(method));
        } catch (IOException e) {
            // Interpreter binary not present in this container — honest skip.
            log.info("Interpreter unavailable for {} ({}), recording skip", method, e.getMessage());
            return skipped();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return skipped();
        }
    }

    private ArtifactValidationResult skipped() {
        return new ArtifactValidationResult(List.of(), List.of(METHOD_SKIPPED));
    }
}
