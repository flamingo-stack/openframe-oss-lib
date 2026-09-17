package com.openframe.test.tests;

import com.openframe.test.api.ScriptApi;
import com.openframe.test.api.ScriptScheduleApi;
import com.openframe.test.data.dto.execution.ScheduleRunConnection;
import com.openframe.test.data.dto.execution.ScheduleRunFilters;
import com.openframe.test.data.dto.execution.ScriptExecution;
import com.openframe.test.data.dto.execution.ScriptExecutionConnection;
import com.openframe.test.data.dto.execution.ScriptExecutionFilters;
import com.openframe.test.data.dto.shared.FilterOption;
import com.openframe.test.data.dto.schedule.ScriptSchedule;
import com.openframe.test.data.dto.script.Script;
import com.openframe.test.data.generator.ScriptGenerator;
import com.openframe.test.data.generator.ScriptScheduleGenerator;
import com.openframe.test.helpers.ai.RunId;
import com.openframe.test.helpers.RelayIds;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.List;
import java.util.Set;

import static com.openframe.test.data.generator.ScriptScheduleGenerator.nextSlot;
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
 * <p>The schedule half reads the same two lists for a schedule, plus its runs — a run being one firing
 * across the schedule's devices, with the executions as its per-device legs. That half creates a
 * schedule of its own a day out and asserts the empty case, which is a real contract: a schedule that
 * has never fired must answer with empty pages and empty facets rather than an error or a null.
 */
@Slf4j
// @Tag("post-mingo") for the same reason as NotificationsTest: on a fresh tenant the only scripts
// ever dispatched are the ones the mingo phase runs, so read before it this class has no history and
// case 1 self-skips. Tagged at class level, not on that one method, so the class stays inside a single
// phase — splitting a class across two phases is what made ExtApi: Archive customer fail on its second
// run against static fixture state.
@Tag("saas")
@Tag("post-mingo")
@DisplayName("Script execution history")
public class ScriptExecutionHistoryTest extends BaseTest {

    private static final RunId RUN_ID = RunId.next();
    private static final Set<String> STATUSES = Set.of("QUEUED", "RUNNING", "SUCCESS", "FAILED");

    private static Script ownScript;
    private static ScriptSchedule ownSchedule;

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

    @Tag("feature")
    @Tag("read")
    @Test
    @DisplayName("Read a schedule's executions, runs and facets")
    public void testScheduleExecutionsAndRuns() {
        ownScript = ScriptApi.createScript(ScriptGenerator.createScriptRequest());
        ownSchedule = ScriptScheduleApi.createSchedule(ScriptScheduleGenerator.dateTimeSchedule(
                "E2E-" + RUN_ID + " history", ownScript.getId(), nextSlot(Duration.ofDays(1)), null));
        String id = ownSchedule.getId();

        ScriptExecutionConnection executions = ScriptScheduleApi.getScheduleExecutions(id, 20);
        assertThat(executions.getFilteredCount()).as("A schedule that never fired has no executions").isZero();
        assertThat(executions.nodes()).as("No execution rows").isEmpty();
        assertThat(executions.getPageInfo()).as("A connection carries pageInfo even when empty").isNotNull();

        ScriptExecutionFilters executionFacets = ScriptScheduleApi.getScheduleExecutionFilters(id);
        assertThat(executionFacets.getFilteredCount()).as("The execution facets agree with the list").isZero();
        assertThat(executionFacets.getStatuses()).as("No status facet without executions").isEmpty();

        ScheduleRunConnection runs = ScriptScheduleApi.getScheduleRuns(id, 20);
        assertThat(runs.getFilteredCount()).as("A schedule that never fired has no runs").isZero();
        assertThat(runs.nodes()).as("No run rows").isEmpty();

        ScheduleRunFilters runFacets = ScriptScheduleApi.getScheduleRunFilters(id);
        assertThat(runFacets.getFilteredCount()).as("The run facets agree with the list").isZero();
        assertThat(runFacets.getStatuses()).as("No status facet without runs").isEmpty();
        assertThat(runFacets.getInitiators()).as("No initiator facet without runs").isEmpty();
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

    @AfterAll
    public static void cleanup() {
        if (ownSchedule != null) {
            try {
                ScriptScheduleApi.deleteSchedule(ownSchedule.getId());
            } catch (RuntimeException e) {
                log.warn("Failed to delete schedule {} — it is left in the tenant: {}", ownSchedule.getId(), e.getMessage());
            }
        }
        if (ownScript != null) {
            try {
                ScriptApi.deleteScript(ownScript.getId());
            } catch (RuntimeException e) {
                log.warn("Failed to delete script {} — it is left in the tenant: {}", ownScript.getId(), e.getMessage());
            }
        }
    }
}
