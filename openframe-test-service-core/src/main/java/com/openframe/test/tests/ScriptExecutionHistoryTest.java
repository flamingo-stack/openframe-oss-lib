package com.openframe.test.tests;

import com.openframe.test.api.ScriptApi;
import com.openframe.test.data.dto.execution.ScriptExecution;
import com.openframe.test.data.dto.execution.ScriptExecutionConnection;
import com.openframe.test.data.dto.execution.ScriptExecutionFilters;
import com.openframe.test.data.dto.shared.FilterOption;
import com.openframe.test.data.dto.script.Script;
import com.openframe.test.helpers.RelayIds;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Execution history read paths (coverage plan item CP-17): the execution list and facets of a script.
 *
 * <p>Nothing is dispatched here — running a script needs an ONLINE device and minutes of waiting, which
 * belongs to the device suites. This reads what those runs left behind, so the case is only meaningful
 * in a tenant where something has already dispatched a script. When nothing has, it says so and skips
 * rather than asserting a page of zero rows against a facet block of zero counts and passing hollowly.
 *
 * <p>The schedule half of CP-17 (schedule executions, runs and their facets) is not here: it needs the
 * script-schedule client, which is still on its own review branch.
 */
@Tag("saas")
@DisplayName("Script execution history")
public class ScriptExecutionHistoryTest extends BaseTest {

    private static final Set<String> STATUSES = Set.of("QUEUED", "RUNNING", "SUCCESS", "FAILED");

    @Tag("feature")
    @Tag("read")
    @Test
    @DisplayName("Read a script's execution history and facets")
    public void testScriptExecutions() {
        Script script = scriptWithHistory();
        assumeTrue(script != null, "No script in this tenant has been dispatched yet, so there is no execution "
                + "history to read. Run a script from a device suite first.");

        ScriptExecutionConnection page = ScriptApi.getExecutions(script.getId(), 20);
        ScriptExecutionFilters facets = ScriptApi.getExecutionFilters(script.getId());
        int total = page.getFilteredCount();
        List<ScriptExecution> rows = page.nodes();
        String scriptGlobalId = RelayIds.decode(script.getId());

        assertThat(page.getPageInfo()).as("A connection carries pageInfo").isNotNull();
        assertThat(total).as("The script has execution history").isPositive();
        assertThat(facets.getFilteredCount()).as("The facets total matches the connection total").isEqualTo(total);
        assertThat(rows).as("One page holds the whole history, or the first 20 of it").hasSize(Math.min(total, 20));
        assertThat(rows).allSatisfy(e -> {
            assertThat(e.getId()).as("Every execution has an id").isNotBlank();
            assertThat(scriptGlobalId).as("Every execution belongs to the script (raw id inside the global id)")
                    .endsWith(":" + e.getScriptId());
            assertThat(e.getStatus()).as("Status is a schema value (" + e.getId() + ")").isIn(STATUSES);
            assertThat(e.getDispatchedAt()).as("Every execution has a dispatch time").isNotBlank();
        });
        List<FilterOption> initiators = facets.getInitiators();
        List<FilterOption> statuses = facets.getStatuses();
        List<FilterOption> machines = facets.getMachines();
        for (List<FilterOption> facet : List.of(initiators, statuses, machines)) {
            assertThat(facet).as("Every facet list is present").isNotNull();
        }
        assertThat(statuses).as("With history, the status facet is populated").isNotEmpty();
        int statusSum = statuses.stream().mapToInt(f -> f.getCount() == null ? 0 : f.getCount()).sum();
        assertThat(statusSum).as("Status facet counts add up to the total").isEqualTo(total);
    }

    /**
     * First script in the tenant that has been dispatched at least once, or null when none has. Each
     * candidate costs one facet call, so the result is held for the run.
     */
    private static Script scriptWithHistory() {
        for (Script candidate : ScriptApi.listScripts()) {
            ScriptExecutionFilters facets = ScriptApi.getExecutionFilters(candidate.getId());
            if (facets.getFilteredCount() > 0) {
                return candidate;
            }
        }
        return null;
    }

}
