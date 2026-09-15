package com.openframe.test.tests;

import com.openframe.test.api.ScriptApi;
import com.openframe.test.api.ScriptScheduleApi;
import com.openframe.test.data.dto.schedule.CreateScriptScheduleInput;
import com.openframe.test.data.dto.schedule.ScriptSchedule;
import com.openframe.test.data.dto.schedule.ScriptScheduleConnection;
import com.openframe.test.data.dto.schedule.ScriptScheduleFilterInput;
import com.openframe.test.data.dto.schedule.ScriptScheduleFilters;
import com.openframe.test.data.dto.script.Script;
import com.openframe.test.data.dto.shared.FilterOption;
import com.openframe.test.data.dto.shared.GraphqlError;
import com.openframe.test.data.generator.ScriptGenerator;
import com.openframe.test.data.generator.ScriptScheduleGenerator;
import com.openframe.test.helpers.ai.RunId;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import static com.openframe.test.data.generator.ScriptScheduleGenerator.HOURLY;
import static com.openframe.test.data.generator.ScriptScheduleGenerator.nextSlot;
import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Script-schedule lifecycle over the GraphQL API (coverage plan item CP-1): create on the nearest
 * 30-minute slot, read it back, edit with full-replacement semantics, archive and unarchive, and the
 * timing-grid rejections. Device assignment is CP-2; with no devices assigned the schedule never
 * dispatches, even when its slot arrives during the run.
 */
@Slf4j
@Tag("saas")
@DisplayName("Script schedules")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class ScriptScheduleTest extends BaseTest {

    private static final RunId RUN_ID = RunId.next();
    private static final String NAME = "E2E-" + RUN_ID + " schedule";

    private static Script script;
    private static ScriptSchedule created;
    private static Instant startAt;

    @Tag("feature")
    @Test
    @DisplayName("Create a script schedule on the nearest 30-minute slot")
    @Order(1)
    public void testCreateSchedule() {
        script = ScriptApi.createScript(ScriptGenerator.createScriptRequest());
        assertThat(script.getId()).as("A script is needed to schedule").isNotNull();

        startAt = nextSlot();
        assertThat(startAt.getEpochSecond() % ScriptScheduleGenerator.SLOT_SECONDS)
                .as("The generator must produce a slot on the 30-minute grid").isZero();

        CreateScriptScheduleInput input = ScriptScheduleGenerator.dateTimeSchedule(NAME, script.getId(), startAt, HOURLY);
        created = ScriptScheduleApi.createSchedule(input);

        assertThat(created.getId()).as("Created schedule should have an id").isNotNull();
        assertThat(created.getName()).as("Name should match").isEqualTo(NAME);
        assertThat(created.getStatus()).as("A new schedule is ACTIVE").isEqualTo("ACTIVE");
        assertThat(created.getTrigger()).as("Trigger should match").isEqualTo("DATE_TIME");
        assertThat(created.getTimeReference()).as("timeReference defaults to SERVER").isEqualTo("SERVER");
        assertThat(created.getOfflineBehavior()).as("offlineBehavior defaults to SKIP").isEqualTo("SKIP");
        assertThat(created.getSelectionMode()).as("selectionMode defaults to SPECIFIC").isEqualTo("SPECIFIC");
        assertThat(created.getStartAt()).as("startAt should be echoed back").isNotNull();
        assertThat(Instant.parse(created.getStartAt())).as("startAt should be the requested slot").isEqualTo(startAt);
        assertThat(created.getRepeat()).as("repeat should match").isEqualTo(HOURLY);
        assertThat(created.getNextRunAt()).as("A scheduled DATE_TIME schedule has a next run").isNotNull();
        assertThat(Instant.parse(created.getNextRunAt())).as("The next run is not before startAt").isAfterOrEqualTo(startAt);
        assertThat(created.getLastRunAt()).as("Nothing has run yet").isNull();
        assertThat(created.getDeviceCount()).as("No devices are assigned").isZero();
        assertThat(created.getScripts()).as("The schedule runs exactly the created script").hasSize(1);
        assertThat(created.getScripts().getFirst().getId()).as("Script id should match").isEqualTo(script.getId());
    }

    @Tag("feature")
    @Tag("read")
    @Test
    @DisplayName("Get and list script schedules")
    @Order(2)
    public void testGetAndListSchedules() {
        requireSchedule();

        ScriptSchedule fetched = ScriptScheduleApi.getSchedule(created.getId());
        assertThat(fetched.getId()).as("Fetched id should match").isEqualTo(created.getId());
        assertThat(fetched.getName()).as("Fetched name should match").isEqualTo(NAME);
        assertThat(fetched.getStartAt()).as("Fetched startAt should match").isEqualTo(created.getStartAt());

        ScriptScheduleConnection page = ScriptScheduleApi.listSchedules(null, RUN_ID.value(), 20);
        assertThat(page.getFilteredCount()).as("Search by the run id finds exactly this schedule").isEqualTo(1);
        assertThat(page.nodes()).extracting(ScriptSchedule::getId).as("The listed schedule is ours").containsExactly(created.getId());
        assertThat(page.getPageInfo()).as("A connection carries pageInfo").isNotNull();

        ScriptScheduleFilters filters = ScriptScheduleApi.getFilters(null);
        assertThat(filters.getFilteredCount()).as("The tenant has at least our schedule").isGreaterThanOrEqualTo(1);
        assertThat(filters.getPlatforms()).extracting(FilterOption::getValue)
                .as("Our WINDOWS schedule contributes to the platform facet").contains("WINDOWS");
    }

    @Tag("feature")
    @Test
    @DisplayName("Edit a script schedule replaces every field and clears the recurrence")
    @Order(3)
    public void testEditSchedule() {
        requireSchedule();
        String renamed = NAME + " renamed";

        ScriptSchedule updated = ScriptScheduleApi.updateSchedule(
                ScriptScheduleGenerator.updateRequest(created, renamed, null));

        assertThat(updated.getId()).as("Updated id should match").isEqualTo(created.getId());
        assertThat(updated.getName()).as("Name should be replaced").isEqualTo(renamed);
        assertThat(updated.getRepeat()).as("A null repeat clears the recurrence (PUT semantics)").isNull();
        assertThat(updated.getStartAt()).as("startAt is untouched by the update").isEqualTo(created.getStartAt());
        assertThat(updated.getTrigger()).as("Trigger is untouched").isEqualTo("DATE_TIME");
        assertThat(updated.getScripts()).extracting(Script::getId).as("Scripts are untouched").containsExactly(script.getId());

        ScriptSchedule refetched = ScriptScheduleApi.getSchedule(created.getId());
        assertThat(refetched.getName()).as("The new name is persisted").isEqualTo(renamed);
        assertThat(refetched.getRepeat()).as("The cleared recurrence is persisted").isNull();
        created = refetched;
    }

    @Tag("feature")
    @Test
    @DisplayName("Archive and unarchive a script schedule")
    @Order(4)
    public void testArchiveAndUnarchiveSchedule() {
        requireSchedule();
        String id = created.getId();

        ScriptSchedule archived = ScriptScheduleApi.archiveSchedule(id);
        assertThat(archived.getStatus()).as("Archived schedule status").isEqualTo("ARCHIVED");

        ScriptScheduleConnection active = ScriptScheduleApi.listSchedules(
                ScriptScheduleFilterInput.builder().statuses(List.of("ACTIVE")).build(), RUN_ID.value(), 20);
        assertThat(active.nodes()).extracting(ScriptSchedule::getId)
                .as("An archived schedule is not listed among ACTIVE ones").doesNotContain(id);

        ScriptScheduleConnection archivedOnly = ScriptScheduleApi.listSchedules(
                ScriptScheduleFilterInput.builder().statuses(List.of("ARCHIVED")).build(), RUN_ID.value(), 20);
        assertThat(archivedOnly.nodes()).extracting(ScriptSchedule::getId)
                .as("An archived schedule is listed when ARCHIVED is requested").contains(id);

        assertThat(ScriptScheduleApi.archiveSchedule(id).getStatus())
                .as("Archiving twice is idempotent").isEqualTo("ARCHIVED");

        ScriptSchedule restored = ScriptScheduleApi.unarchiveSchedule(id);
        assertThat(restored.getStatus()).as("Unarchived schedule is ACTIVE again").isEqualTo("ACTIVE");
        assertThat(ScriptScheduleApi.getSchedule(id).getStatus()).as("The restored status is persisted").isEqualTo("ACTIVE");
    }

    @Tag("feature")
    @Tag("negative")
    @Test
    @DisplayName("Schedule rejects timing that is off the 30-minute grid")
    @Order(5)
    public void testRejectsOffGridTiming() {
        requireSchedule();
        int before = ScriptScheduleApi.listSchedules(null, RUN_ID.value(), 20).getFilteredCount();
        Instant slot = nextSlot();

        List<GraphqlError> offGrid = ScriptScheduleApi.attemptCreateScheduleErrors(
                ScriptScheduleGenerator.dateTimeSchedule(NAME + " off-grid", script.getId(),
                        slot.plus(7, ChronoUnit.MINUTES), null));
        assertThat(offGrid).as("A startAt at xx:07 is rejected with a GraphQL error").isNotEmpty();
        assertThat(offGrid.getFirst().getMessage()).as("The rejection carries a message").isNotBlank();

        List<GraphqlError> badRepeat = ScriptScheduleApi.attemptCreateScheduleErrors(
                ScriptScheduleGenerator.dateTimeSchedule(NAME + " bad-repeat", script.getId(), slot, 1000L));
        assertThat(badRepeat).as("A repeat that is not a whole number of 30-minute slots is rejected").isNotEmpty();

        CreateScriptScheduleInput onlineWithStart = ScriptScheduleGenerator.dateTimeSchedule(
                NAME + " online-with-start", script.getId(), slot, null);
        onlineWithStart.setTrigger("DEVICE_ONLINE");
        List<GraphqlError> onlineErrors = ScriptScheduleApi.attemptCreateScheduleErrors(onlineWithStart);
        assertThat(onlineErrors).as("A DEVICE_ONLINE schedule with a startAt is rejected").isNotEmpty();

        int after = ScriptScheduleApi.listSchedules(null, RUN_ID.value(), 20).getFilteredCount();
        assertThat(after).as("Rejected creates leave nothing behind").isEqualTo(before);
    }

    @AfterAll
    public static void cleanup() {
        if (created != null) {
            try {
                ScriptScheduleApi.deleteSchedule(created.getId());
            } catch (RuntimeException e) {
                log.warn("Failed to delete schedule {} — it is left in the tenant: {}", created.getId(), e.getMessage());
            }
        }
        if (script != null) {
            try {
                ScriptApi.deleteScript(script.getId());
            } catch (RuntimeException e) {
                log.warn("Failed to delete script {} — it is left in the tenant: {}", script.getId(), e.getMessage());
            }
        }
    }

    private static void requireSchedule() {
        assumeTrue(created != null && created.getId() != null,
                "No schedule was created in \"Create a script schedule on the nearest 30-minute slot\"; see that failure");
    }
}
