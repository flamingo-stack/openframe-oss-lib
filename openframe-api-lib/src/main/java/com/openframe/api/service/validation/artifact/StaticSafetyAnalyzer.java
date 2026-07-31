package com.openframe.api.service.validation.artifact;

import com.openframe.data.document.rmm.ScriptShell;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.Stream;

/**
 * Static safety rules applied to every artifact before it may enter the
 * library. Deliberately a small, explicit catalog — per-organization guardrail
 * rules (PolicyEnforcementService in the AI agent) remain the
 * tenant-configurable layer on top; this class encodes only the
 * universally-catastrophic (ERROR) and universally-sensitive (HIGH_IMPACT)
 * patterns.
 */
@Component
public class StaticSafetyAnalyzer {

    private static final String METHOD = "STATIC_RULES";

    private record Rule(Pattern pattern, ValidationSeverity severity, String code, String message) {
        static Rule of(String regex, ValidationSeverity severity, String code, String message) {
            return new Rule(Pattern.compile(regex, Pattern.CASE_INSENSITIVE), severity, code, message);
        }
    }

    /** Shared between scripts and SQL: secrets never belong inline in a library artifact. */
    private static final Rule CREDENTIALS_RULE = Rule.of(
            "(password|passwd|secret|api[_-]?key|token)\\s*[:=]\\s*['\"][^'\"\\s]{4,}['\"]",
            ValidationSeverity.HIGH_IMPACT,
            "CREDENTIALS", "hardcoded credential — use script env vars (secret) instead");

    private static final List<Rule> SCRIPT_RULES = Stream.concat(Stream.of(
            // catastrophic — block
            Rule.of("rm\\s+(-[a-z]*[rf][a-z]*\\s+)+(/|/\\*)(\\s|$|['\"])", ValidationSeverity.ERROR,
                    "DESTRUCTIVE_ROOT_DELETE", "deletes the filesystem root"),
            Rule.of("Remove-Item\\b[^\\n]*-Recurse[^\\n]*\\s(C:\\\\|/)(\\s|$|['\"])", ValidationSeverity.ERROR,
                    "DESTRUCTIVE_ROOT_DELETE", "recursively deletes a drive/filesystem root"),
            Rule.of("dd\\s+[^\\n]*of=/dev/(sd|nvme|disk|hd)", ValidationSeverity.ERROR,
                    "DESTRUCTIVE_DISK_WRITE", "writes raw data over a block device"),
            Rule.of("mkfs(\\.|\\s)", ValidationSeverity.ERROR,
                    "DESTRUCTIVE_FORMAT", "formats a filesystem"),
            Rule.of("(^|[\\n;&|]\\s*)format\\s+[a-z]:", ValidationSeverity.ERROR,
                    "DESTRUCTIVE_FORMAT", "formats a drive"),
            Rule.of(":\\(\\)\\s*\\{\\s*:\\|:&\\s*\\}\\s*;\\s*:", ValidationSeverity.ERROR,
                    "FORK_BOMB", "fork bomb"),
            // sensitive — allowed only with recorded human approval
            Rule.of("(^|[\\s;&|(])(shutdown|reboot)\\b", ValidationSeverity.HIGH_IMPACT,
                    "REBOOT", "shuts down or reboots the machine"),
            Rule.of("Restart-Computer|Stop-Computer", ValidationSeverity.HIGH_IMPACT,
                    "REBOOT", "shuts down or reboots the machine"),
            Rule.of("Stop-Service|systemctl\\s+(stop|disable)|sc\\s+stop", ValidationSeverity.HIGH_IMPACT,
                    "SERVICE_STOP", "stops or disables a service"),
            Rule.of("Set-ExecutionPolicy|reg\\s+add\\s+[\"']?HKLM|New-ItemProperty\\s+[^\\n]*HKLM",
                    ValidationSeverity.HIGH_IMPACT,
                    "SYSTEM_CONFIG", "changes system security configuration"),
            Rule.of("(userdel|net\\s+user\\s+\\S+\\s+/delete|Remove-LocalUser)", ValidationSeverity.HIGH_IMPACT,
                    "USER_DELETE", "deletes a user account")
    ), Stream.of(CREDENTIALS_RULE)).toList();

    private static final List<Rule> SQL_RULES = List.of(CREDENTIALS_RULE);

    public ArtifactValidationResult analyzeScript(ScriptShell shell, String body) {
        List<ValidationFinding> findings = new ArrayList<>(matchRules(SCRIPT_RULES, body));
        if ((shell == ScriptShell.BASH || shell == ScriptShell.SHELL)
                && !body.contains("set -e")) {
            findings.add(new ValidationFinding(ValidationSeverity.WARNING, "NO_ERROR_HANDLING",
                    "bash script has no 'set -e' — failures mid-script will go unnoticed"));
        }
        return new ArtifactValidationResult(List.copyOf(findings), List.of(METHOD));
    }

    /**
     * osquery SQL is read-only by construction (OsquerySqlValidator enforces
     * SELECT-only), so only the credential rule is meaningful here.
     */
    public ArtifactValidationResult analyzeSql(String sql) {
        return new ArtifactValidationResult(List.copyOf(matchRules(SQL_RULES, sql)), List.of(METHOD));
    }

    private List<ValidationFinding> matchRules(List<Rule> rules, String text) {
        List<ValidationFinding> findings = new ArrayList<>();
        for (Rule rule : rules) {
            if (rule.pattern().matcher(text).find()) {
                findings.add(new ValidationFinding(rule.severity(), rule.code(), rule.message()));
            }
        }
        return findings;
    }
}
