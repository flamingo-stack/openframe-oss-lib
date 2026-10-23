package com.openframe.test.tests;

import com.openframe.test.api.DeviceApi;
import com.openframe.test.data.dto.device.DeviceStatus;
import com.openframe.test.data.dto.device.Machine;
import com.openframe.test.helpers.FleetWait;
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

import static com.openframe.test.data.generator.DeviceGenerator.osAndStatusDevicesFilter;
import static com.openframe.test.data.generator.ScriptScheduleGenerator.nextSlot;
import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Execution history read paths (coverage plan item CP-17): the execution list and facets of a script.
 *
 * <p>The first case dispatches a script of its own and reads back that script's history. It used to
 * read whatever the tenant happened to hold, which meant it skipped itself on every pipeline run: the
 * only cases that dispatch anything are the assistant ones, and they delete every script they create.
 *
 * <p>The schedule half reads the same two lists for a schedule, plus its runs — a run being one firing
 * across the schedule's devices, with the executions as its per-device legs. That half creates a
 * schedule of its own a day out and asserts the empty case, which is a real contract: a schedule that
 * has never fired must answer with empty pages and empty facets rather than an error or a null.
 */
@Slf4j
// @Tag("post-mingo") because dispatching needs an enrolled ONLINE machine, and one only exists after
// the device and assistant phases have run. Tagged at class level so the class stays inside a single
// phase — splitting one across two phases is what made ExtApi: Archive customer fail on its second run.
// @Tag("needs-device") marks the same dependency for runs that are not the pipeline: the dev suite
// runs the `saas` tag against a long-lived tenant with no agent installed, where every case here
// aborts on its assumption. The `tenant` env excludes this tag; the pipeline phases do not.
@Tag("saas")
@Tag("post-mingo")
@Tag("needs-device")
@DisplayName("Script execution history")
public class ScriptExecutionHistoryTest extends BaseTest {

    private static final RunId RUN_ID = RunId.next();
    private static final Set<String> STATUSES = Set.of("QUEUED", "RUNNING", "SUCCESS", "FAILED");

    private static Script ownScript;
    private static Script ownDispatched;
    private static ScriptSchedule ownSchedule;

    private static final String PRIVILEGE_LEVEL = "ADMIN";
    private static final int DISPATCH_TIMEOUT_SECONDS = 180;

    @Tag("feature")
    @Tag("read")
    @Test
    @DisplayName("Read a script's execution history and facets")
    public void testScriptExecutions() {
        Script script = dispatchedScript();

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
     * A script this case owns, with at least one execution against it.
     *
     * <p>This used to hunt the tenant for someone else's dispatched script. That never worked on a
     * pipeline run: the only cases that dispatch anything are the assistant ones, and they delete every
     * script they create in their own teardown, so no candidate survived and this case skipped itself on
     * every run. Moving the class after the assistant phase did not help for the same reason — the fix
     * was to stop depending on found state.
     *
     * <p>What that phase does provide is an enrolled ONLINE machine, which is what makes dispatching
     * here possible at all.
     */
    private static Script dispatchedScript() {
        List<Machine> online = DeviceApi.getDevices(osAndStatusDevicesFilter("WINDOWS", DeviceStatus.ONLINE));
        assumeTrue(!online.isEmpty(), "No ONLINE Windows device in this tenant, so no script can be dispatched"
                + " and there is no execution history to read.");

        ownDispatched = ScriptApi.createScript(ScriptGenerator.createScriptRequest());
        ScriptApi.runScript(online.getFirst().getMachineId(), ownDispatched.getId(), PRIVILEGE_LEVEL);

        // The dispatch returns as soon as the request is on the wire; the history row appears when the
        // agent reports. Poll rather than assume, and assert so the failure names the wait.
        String scriptId = ownDispatched.getId();
        ScriptExecutionConnection dispatched = FleetWait.until(
                "the dispatch to appear in script " + scriptId + "'s execution history",
                () -> ScriptApi.getExecutions(scriptId, 20),
                c -> c.getFilteredCount() > 0,
                DISPATCH_TIMEOUT_SECONDS);
        assertThat(dispatched.getFilteredCount())
                .as("Dispatched a script to %s but no execution appeared within %ds",
                        online.getFirst().getMachineId(), DISPATCH_TIMEOUT_SECONDS)
                .isPositive();
        return ownDispatched;
    }

    @AfterAll
    public static void cleanup() {
        if (ownSchedule != null) {
            try {
                ScriptScheduleApi.deleteSchedule(ownSchedule.getId());
            } catch (RuntimeException | AssertionError e) {
                log.warn("Failed to delete schedule {} — it is left in the tenant: {}", ownSchedule.getId(), e.getMessage());
            }
        }
        if (ownDispatched != null) {
            try {
                ScriptApi.deleteScript(ownDispatched.getId());
            } catch (RuntimeException | AssertionError e) {
                log.warn("Failed to delete script {} — it is left in the tenant: {}", ownDispatched.getId(), e.getMessage());
            }
        }
        if (ownScript != null) {
            try {
                ScriptApi.deleteScript(ownScript.getId());
            } catch (RuntimeException | AssertionError e) {
                log.warn("Failed to delete script {} — it is left in the tenant: {}", ownScript.getId(), e.getMessage());
            }
        }
    }
}
