package com.openframe.api.service.validation.artifact;

import com.openframe.core.exception.ArtifactValidationException;
import com.openframe.data.document.rmm.OsType;
import com.openframe.data.document.rmm.ScriptShell;
import com.openframe.data.document.rmm.ScriptValidation;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Mandatory gate in front of every script-library write. Lives inside the
 * shared {@code ScriptService} call path, so the GraphQL UI mutation and the
 * AI agent tool both pass through it — there is no code path that saves a
 * script without it.
 *
 * <p>Blocking findings throw {@link ArtifactValidationException} listing each
 * specific failure. High-impact findings are allowed only when the acting
 * user is a human (recorded as the approver); the AI agent's sentinel actor
 * cannot approve its own high-impact artifacts.
 */
@Component
@RequiredArgsConstructor
public class ScriptValidationGate {

    /** Matches the AI agent's sentinel for actions that carry no human user. */
    private static final String AI_AGENT_ACTOR = "AI_AGENT";

    private final ScriptSyntaxValidator syntaxValidator;
    private final StaticSafetyAnalyzer safetyAnalyzer;

    public ScriptValidation validateOrThrow(ScriptShell shell, String body,
                                            List<OsType> platforms, String actor) {
        ArtifactValidationResult result = ArtifactValidationResult.merge(
                syntaxValidator.validate(shell, body),
                safetyAnalyzer.analyzeScript(shell, body));

        if (result.blocked()) {
            throw new ArtifactValidationException(result.errorMessages());
        }
        boolean highImpact = result.highImpact();
        if (highImpact && AI_AGENT_ACTOR.equals(actor)) {
            List<String> errors = new ArrayList<>(result.warningMessages());
            errors.add("high-impact script requires recorded human approval — "
                    + "an admin must initiate or approve this save");
            throw new ArtifactValidationException(errors);
        }
        Instant now = Instant.now();
        return ScriptValidation.builder()
                .validatedAt(now)
                .methods(result.methods())
                .targetOs(platforms == null ? List.of()
                        : platforms.stream().map(Enum::name).toList())
                .highImpact(highImpact)
                .warnings(result.warningMessages())
                .approvedBy(highImpact ? actor : null)
                .approvedAt(highImpact ? now : null)
                .build();
    }
}
