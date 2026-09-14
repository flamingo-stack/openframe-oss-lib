package com.openframe.test.tests;

import com.openframe.test.api.ScriptApi;
import com.openframe.test.data.dto.execution.ScriptExecution;
import com.openframe.test.data.dto.execution.ScriptExecutionConnection;
import com.openframe.test.data.dto.execution.ScriptExecutionFilters;
import com.openframe.test.data.dto.script.Script;
import com.openframe.test.data.generator.ScriptGenerator;
import com.openframe.test.helpers.RelayIds;
import com.openframe.test.helpers.ai.RunId;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Execution history read paths (coverage plan item CP-17): the execution list and facets of a script.
 * Nothing is dispatched — a script that already has history in the tenant is preferred, and a script
 * of its own is created only when the tenant has none.
 *
 * <p>The schedule half of CP-17 (schedule executions, runs and their facets) is not here: it needs the
 * script-schedule client, which is still on its own review branch.
 */
@Tag("saas")
@DisplayName("Script execution history")
public class ScriptExecutionHistoryTest extends BaseTest {

    private static final RunId RUN_ID = RunId.next();
    private static final Set<String> STATUSES = Set.of("QUEUED", "RUNNING", "SUCCESS", "FAILED");

    private static Script ownScript;

    @Tag("feature")
    @Tag("read")
    @Test
    @DisplayName("Read a script's execution history and facets")
    public void testScriptExecutions() {
        List<Script> scripts = ScriptApi.listScripts();
        Script withHistory = scripts.stream()
                .filter(s -> ScriptApi.getExecutionFilters(s.getId()).getFilteredCount() > 0)
                .findFirst().orElse(null);
        Script script = withHistory != null ? withHistory : (scripts.isEmpty() ? ownScript() : scripts.getFirst());

        ScriptExecutionConnection page = ScriptApi.getExecutions(script.getId(), 20);
        ScriptExecutionFilters facets = ScriptApi.getExecutionFilters(script.getId());
        assertThat(page.getPageInfo()).as("A connection carries pageInfo").isNotNull();
        assertThat(page.getFilteredCount()).as("filteredCount is never negative").isGreaterThanOrEqualTo(0);
        assertThat(facets.getFilteredCount()).as("The facets total matches the connection total").isEqualTo(page.getFilteredCount());
        assertThat(page.nodes()).hasSize(Math.min(page.getFilteredCount(), 20));
        assertThat(page.nodes()).allSatisfy(e -> {
            assertThat(e.getId()).as("Every execution has an id").isNotBlank();
            assertThat(RelayIds.decode(script.getId())).as("Every execution belongs to the script (raw id inside the global id)")
                    .endsWith(":" + e.getScriptId());
            assertThat(e.getStatus()).as("Status is a schema value (" + e.getId() + ")").isIn(STATUSES);
            assertThat(e.getDispatchedAt()).as("Every execution has a dispatch time").isNotBlank();
        });
        for (List<?> facet : List.of(facets.getInitiators(), facets.getStatuses(), facets.getMachines())) {
            assertThat(facet).as("Every facet list is present").isNotNull();
        }
        if (page.getFilteredCount() > 0) {
            assertThat(facets.getStatuses()).as("With history, the status facet is populated").isNotEmpty();
            int statusSum = facets.getStatuses().stream().mapToInt(f -> f.getCount() == null ? 0 : f.getCount()).sum();
            assertThat(statusSum).as("Status facet counts add up to the total").isEqualTo(page.getFilteredCount());
        }
    }

    private static Script ownScript() {
        if (ownScript == null) {
            ownScript = ScriptApi.createScript(ScriptGenerator.createScriptRequest());
        }
        return ownScript;
    }

    @AfterAll
    public static void cleanup() {
        if (ownScript != null) {
            try {
                ScriptApi.deleteScript(ownScript.getId());
            } catch (RuntimeException ignored) {
                // best effort
            }
        }
    }
}
