package com.openframe.test.tests.ai;

import com.openframe.test.api.KnowledgeBaseApi;
import com.openframe.test.api.ScriptApi;
import com.openframe.test.data.dto.knowledgebase.KnowledgeBaseItem;
import com.openframe.test.data.dto.script.CreateScriptInput;
import com.openframe.test.data.dto.script.Script;
import com.openframe.test.helpers.ai.RunId;
import com.openframe.test.helpers.ai.RunResult;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * AI assistant entity-creation/mutation E2E (no machine required): the assistant creates/updates/deletes
 * scripts and creates a KB article via its tools (each a mutation requiring an ADMIN approval, auto-approved
 * by the runner), verified through the product's own Script / Knowledge Base APIs (channel B).
 *
 * <p>Immune to the searchMachines online-flap — no machine is involved.
 */
@Tag("ai")
@Tag("mingo")
@DisplayName("Mingo — scripts & KB")
public class MingoEntityMutationTest extends MingoBaseTest {

    private final List<String> scriptIds = new ArrayList<>();
    private String createdArticleId;

    @Test
    @Tag("script")
    @DisplayName("Mingo creates a script")
    @Disabled("TODO: review and fix later")
    public void testScriptCreate() {
        RunId runId = RunId.next();
        String name = "E2E-" + runId;

        RunResult result = prompt("Create a shell script named exactly \"" + name
                + "\" whose body prints the text hello. Use a bash script.");

        Script script = findScriptByName(name);
        assertThat(script).as("A script named %s should exist.\n%s", name, result).isNotNull();
        scriptIds.add(script.getId());

        Script full = ScriptApi.getScript(script.getId());
        assertThat(full.getScriptBody()).as("Script body should be non-empty.\n%s", result).isNotBlank();
    }

    @Test
    @Tag("script")
    @DisplayName("Mingo updates a script in place")
    public void testScriptUpdate() {
        RunId runId = RunId.next();
        String name = "E2E-" + runId;
        Script seed = seedScript(name);
        scriptIds.add(seed.getId());
        String token = "UPDATED-" + runId;

        RunResult result = prompt("Update the script named \"" + name + "\" so that its body prints exactly "
                + token + ". Keep the same script.");

        // Same id must now carry the new body — if the assistant recreated instead of updating, the seed's
        // body is unchanged and this fails.
        Script after = ScriptApi.getScript(seed.getId());
        assertThat(after).as("Original script id should still exist.\n%s", result).isNotNull();
        assertThat(after.getScriptBody())
                .as("Script %s body should contain the updated token.\n%s", seed.getId(), result)
                .contains(token);
    }

    @Test
    @Tag("script")
    @DisplayName("Mingo deletes only the target script")
    public void testScriptDeleteScoping() {
        RunId runId = RunId.next();
        Script target = seedScript("E2E-" + runId + "-target");
        Script control = seedScript("E2E-" + runId + "-control");
        scriptIds.add(target.getId());
        scriptIds.add(control.getId());

        RunResult result = prompt("Delete the script named \"E2E-" + runId
                + "-target\". Do not touch any other script.");

        List<Script> all = ScriptApi.listScripts();
        boolean targetPresent = all.stream().anyMatch(s -> target.getId().equals(s.getId()));
        boolean controlPresent = all.stream().anyMatch(s -> control.getId().equals(s.getId()));
        assertThat(targetPresent).as("Target script should be deleted.\n%s", result).isFalse();
        assertThat(controlPresent).as("Control script must survive.\n%s", result).isTrue();
    }

    @Test
    @Tag("kb")
    @DisplayName("Mingo creates a KB article")
    public void testKbArticleCreate() {
        RunId runId = RunId.next();
        String title = "E2E-" + runId;

        RunResult result = prompt("Create a knowledge base article titled exactly \"" + title
                + "\" explaining how to reset a user password. Put it in any available folder or the root.");

        List<KnowledgeBaseItem> matches = KnowledgeBaseApi.getKnowledgeBaseItems(null, title, 25);
        KnowledgeBaseItem article = matches.stream()
                .filter(i -> title.equals(i.getName()))
                .findFirst()
                .orElse(null);
        assertThat(article).as("A KB article titled %s should exist.\n%s", title, result).isNotNull();
        this.createdArticleId = article.getId();
    }

    // ---- helpers ----


    private Script findScriptByName(String name) {
        return ScriptApi.listScripts().stream()
                .filter(s -> name.equals(s.getName()))
                .findFirst()
                .orElse(null);
    }

    /** Seeds a valid Windows/PowerShell script directly (setup, not under test). */
    private Script seedScript(String name) {
        return ScriptApi.createScript(CreateScriptInput.builder()
                .name(name)
                .description("e2e seed")
                .shell("POWERSHELL")
                .privilegeLevel("USER")
                .scriptBody("Write-Output 'seed'")
                .supportedPlatforms(List.of("WINDOWS"))
                .defaultTimeoutSeconds(90)
                .build());
    }

    @AfterEach
    public void teardown() {
        for (String id : scriptIds) {
            try {
                ScriptApi.deleteScript(id);
            } catch (RuntimeException ignored) {
                // best-effort (target may already be deleted)
            }
        }
        scriptIds.clear();
        if (createdArticleId != null) {
            try {
                KnowledgeBaseApi.archiveArticle(createdArticleId);
            } catch (RuntimeException ignored) {
                // best-effort
            }
            createdArticleId = null;
        }
    }
}
