package com.openframe.test.tests;

import com.openframe.test.api.TimeTrackingApi;
import com.openframe.test.data.dto.shared.DateRangeInput;
import com.openframe.test.data.dto.shared.GraphqlError;
import com.openframe.test.data.dto.timetracking.CreateTimeEntryInput;
import com.openframe.test.data.dto.timetracking.EmployeeTimeStats;
import com.openframe.test.data.dto.timetracking.TimeEntry;
import com.openframe.test.data.dto.timetracking.TimeEntryFilterInput;
import com.openframe.test.data.dto.timetracking.TimerInput;
import com.openframe.test.data.dto.timetracking.UpdateTimeEntryInput;
import com.openframe.test.helpers.RelayIds;
import com.openframe.test.helpers.ai.RunId;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Time tracking over the GraphQL API (coverage plan item CP-6): the caller's timer through pause,
 * resume and stop; the guards around a missing or already-active timer; manual entries with the
 * employee list and stats; and the content and duration validations. Every entry the class creates
 * is deleted afterwards and any timer it leaves is cancelled, so the owner's stats are not skewed.
 */
@Tag("saas")
@DisplayName("Time tracking")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class TimeTrackingTest extends BaseTest {

    private static final RunId RUN_ID = RunId.next();
    private static final String NOTES = "E2E-" + RUN_ID + " time tracking";
    private static final long PAUSE_MS = 2_000;

    private static final List<String> createdEntryIds = new ArrayList<>();
    private static String userRawId;
    private static String userGlobalId;
    private static TimeEntry timerEntry;

    /** A leftover timer from an earlier run would make startTimer refuse; start from a clean slate. */
    @BeforeAll
    public static void cancelLeftoverTimer() {
        TimeTrackingApi.cancelTimer();
    }

    @Tag("feature")
    @Test
    @DisplayName("Run a timer through pause, resume and stop")
    @Order(1)
    public void testTimerLifecycle() throws InterruptedException {
        TimeEntry started = TimeTrackingApi.startTimer(TimerInput.builder().notes(NOTES).build());
        createdEntryIds.add(started.getId());
        userRawId = started.getUserId();
        userGlobalId = userRawId == null ? null : RelayIds.userId(userRawId);
        assertThat(started.getId()).as("A started timer has an id").isNotNull();
        assertThat(started.getState()).as("A started timer is RUNNING").isEqualTo("RUNNING");
        assertThat(started.getSource()).as("A timer entry has source TIMER").isEqualTo("TIMER");
        assertThat(started.getStartedAt()).as("startedAt is set on start").isNotNull();
        assertThat(started.getEndedAt()).as("A running timer has no endedAt").isNull();
        assertThat(started.getPausedAt()).as("A running timer is not paused").isNull();
        assertThat(started.getNotes()).as("Notes are stored").isEqualTo(NOTES);
        assertThat(userRawId).as("The entry carries its user id").isNotNull();
        assertThat(started.getUser()).as("The entry resolves its user").isNotNull();

        TimeEntry current = TimeTrackingApi.currentTimer();
        assertThat(current).as("currentTimer returns the running timer").isNotNull();
        assertThat(current.getId()).as("currentTimer is the started entry").isEqualTo(started.getId());

        Thread.sleep(PAUSE_MS);
        TimeEntry paused = TimeTrackingApi.pauseTimer();
        assertThat(paused.getState()).as("A paused timer is PAUSED").isEqualTo("PAUSED");
        assertThat(paused.getPausedAt()).as("pausedAt is set on pause").isNotNull();
        assertThat(TimeTrackingApi.pauseTimer().getState()).as("Pausing again is idempotent").isEqualTo("PAUSED");

        Thread.sleep(PAUSE_MS);
        TimeEntry resumed = TimeTrackingApi.resumeTimer();
        assertThat(resumed.getState()).as("A resumed timer is RUNNING").isEqualTo("RUNNING");
        assertThat(resumed.getPausedAt()).as("pausedAt is cleared on resume").isNull();
        assertThat(resumed.getBreakSeconds()).as("The pause is accounted as break time").isGreaterThanOrEqualTo(1L);
        assertThat(TimeTrackingApi.resumeTimer().getState()).as("Resuming again is idempotent").isEqualTo("RUNNING");

        Thread.sleep(PAUSE_MS);
        TimeEntry stopped = TimeTrackingApi.stopTimer(TimerInput.builder().notes(NOTES + " stopped").build());
        timerEntry = stopped;
        assertThat(stopped.getState()).as("A stopped timer is COMPLETED").isEqualTo("COMPLETED");
        assertThat(stopped.getEndedAt()).as("endedAt is set on stop").isNotNull();
        assertThat(stopped.getNotes()).as("Notes given on stop replace the earlier ones").isEqualTo(NOTES + " stopped");
        assertThat(stopped.getDurationSeconds()).as("Worked time excludes the break").isGreaterThanOrEqualTo(1L);
        assertThat(stopped.getBreakSeconds()).as("Break time survives the stop").isGreaterThanOrEqualTo(1L);
        long elapsed = Instant.parse(stopped.getEndedAt()).getEpochSecond() - Instant.parse(stopped.getStartedAt()).getEpochSecond();
        assertThat(stopped.getDurationSeconds() + stopped.getBreakSeconds())
                .as("Worked time plus break time is the elapsed time").isBetween(elapsed - 1, elapsed + 1);

        assertThat(TimeTrackingApi.currentTimer()).as("No timer is active after stop").isNull();
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        DateRangeInput todayRange = DateRangeInput.builder()
                .startDate(today.toString()).endDate(today.plusDays(1).toString()).build();
        assertThat(TimeTrackingApi.myTimeEntries(todayRange, null, 50).ids())
                .as("The stopped entry is among today's own entries").contains(stopped.getId());
        assertThat(TimeTrackingApi.getTimeEntry(stopped.getId()).getState())
                .as("The entry is fetched by id as COMPLETED").isEqualTo("COMPLETED");
    }

    @Tag("feature")
    @Tag("negative")
    @Test
    @DisplayName("Timer guards: nothing to pause, no second timer, no editing while running")
    @Order(2)
    public void testTimerGuards() {
        assertThat(TimeTrackingApi.cancelTimer()).as("Cancelling with no active timer returns false").isFalse();
        List<GraphqlError> noTimer = TimeTrackingApi.attemptPauseTimerErrors();
        assertThat(noTimer).as("Pausing with no active timer is refused").isNotEmpty();
        assertThat(noTimer.getFirst().getMessage()).as("The refusal names the cause").containsIgnoringCase("no active timer");

        TimeEntry running = TimeTrackingApi.startTimer(TimerInput.builder().notes(NOTES + " guard").build());
        createdEntryIds.add(running.getId());
        try {
            List<GraphqlError> second = TimeTrackingApi.attemptStartTimerErrors(TimerInput.builder().notes(NOTES + " second").build());
            assertThat(second).as("A second timer while one is active is refused").isNotEmpty();
            assertThat(second.getFirst().getMessage()).as("The refusal names the cause").containsIgnoringCase("active timer");

            List<GraphqlError> edit = TimeTrackingApi.attemptUpdateTimeEntryErrors(
                    UpdateTimeEntryInput.builder().id(running.getId()).notes(NOTES + " edited").build());
            assertThat(edit).as("Editing a running timer is refused").isNotEmpty();
            assertThat(edit.getFirst().getMessage()).as("The refusal says to stop it first").containsIgnoringCase("running");
        } finally {
            assertThat(TimeTrackingApi.cancelTimer()).as("Cancelling the active timer returns true").isTrue();
        }
        assertThat(TimeTrackingApi.currentTimer()).as("A cancelled timer is gone").isNull();
        assertThat(TimeTrackingApi.getTimeEntry(running.getId())).as("A cancelled timer leaves no entry").isNull();
    }

    @Tag("feature")
    @Test
    @DisplayName("Create, edit and delete a manual time entry")
    @Order(3)
    public void testManualEntry() {
        requireUser();
        Instant startedAt = Instant.now().minus(1, ChronoUnit.HOURS).truncatedTo(ChronoUnit.SECONDS);
        TimeEntry created = TimeTrackingApi.createTimeEntry(CreateTimeEntryInput.builder()
                .userId(userGlobalId).notes(NOTES + " manual").startedAt(startedAt.toString()).durationSeconds(3600L).build());
        createdEntryIds.add(created.getId());
        assertThat(created.getSource()).as("A created entry has source MANUAL").isEqualTo("MANUAL");
        assertThat(created.getState()).as("A manual entry is COMPLETED").isEqualTo("COMPLETED");
        assertThat(created.getDurationSeconds()).as("Duration is stored").isEqualTo(3600L);
        assertThat(Instant.parse(created.getEndedAt())).as("endedAt is startedAt + duration").isEqualTo(startedAt.plusSeconds(3600));
        assertThat(created.getUserId()).as("The entry belongs to the given user").isEqualTo(userRawId);

        TimeEntry updated = TimeTrackingApi.updateTimeEntry(UpdateTimeEntryInput.builder()
                .id(created.getId()).notes(NOTES + " manual edited").durationSeconds(1800L).build());
        assertThat(updated.getNotes()).as("Notes are updated").isEqualTo(NOTES + " manual edited");
        assertThat(updated.getDurationSeconds()).as("Duration is updated").isEqualTo(1800L);
        assertThat(Instant.parse(updated.getEndedAt())).as("endedAt follows the new duration").isEqualTo(startedAt.plusSeconds(1800));
        assertThat(updated.getStartedAt()).as("startedAt is untouched by a partial update").isEqualTo(created.getStartedAt());

        TimeEntryFilterInput mine = TimeEntryFilterInput.builder()
                .employeeIds(List.of(userGlobalId))
                .startedFrom(startedAt.minusSeconds(60).toString())
                .startedTo(Instant.now().plusSeconds(60).toString())
                .build();
        assertThat(TimeTrackingApi.employeeTimeEntries(mine, null, 50).ids())
                .as("The employee list shows the entry for its user and period").contains(created.getId());
        EmployeeTimeStats stats = TimeTrackingApi.employeeTimeStats(mine);
        assertThat(stats.getPeriodEntryCount()).as("The period counts at least this entry").isGreaterThanOrEqualTo(1L);
        assertThat(stats.getPeriodTotalSeconds()).as("The period total includes the entry").isGreaterThanOrEqualTo(1800L);

        assertThat(TimeTrackingApi.deleteTimeEntry(created.getId())).as("Deleting an existing entry returns true").isTrue();
        assertThat(TimeTrackingApi.deleteTimeEntry(created.getId())).as("Deleting it again returns false").isFalse();
        assertThat(TimeTrackingApi.getTimeEntry(created.getId())).as("A deleted entry is gone").isNull();
        createdEntryIds.remove(created.getId());
    }

    @Tag("feature")
    @Tag("negative")
    @Test
    @DisplayName("Manual entry rejects missing content")
    @Order(4)
    public void testManualEntryRequiresContent() {
        requireUser();
        String startedAt = Instant.now().minus(2, ChronoUnit.HOURS).truncatedTo(ChronoUnit.SECONDS).toString();
        List<GraphqlError> noContent = TimeTrackingApi.attemptCreateTimeEntryErrors(CreateTimeEntryInput.builder()
                .userId(userGlobalId).startedAt(startedAt).durationSeconds(600L).build());
        assertThat(noContent).as("An entry without a ticket or notes is refused").isNotEmpty();
        assertThat(noContent.getFirst().getMessage()).as("The refusal names the rule").containsIgnoringCase("notes");
    }

    /**
     * Kept as its own case on purpose: at origin/main 9cc95b263 the api-service answers HTTP 502 to
     * {@code durationSeconds: 0} instead of the GraphQL validation error the service layer defines
     * ("Duration must be positive"), so this case fails until the product maps that rejection. The
     * assertion states the contract; it is not weakened to match the bug.
     */
    @Tag("feature")
    @Tag("negative")
    @Test
    @DisplayName("Manual entry rejects a non-positive duration")
    @Order(5)
    public void testManualEntryRejectsZeroDuration() {
        requireUser();
        String startedAt = Instant.now().minus(2, ChronoUnit.HOURS).truncatedTo(ChronoUnit.SECONDS).toString();
        List<GraphqlError> zero = TimeTrackingApi.attemptCreateTimeEntryErrors(CreateTimeEntryInput.builder()
                .userId(userGlobalId).notes(NOTES + " zero").startedAt(startedAt).durationSeconds(0L).build());
        assertThat(zero).as("A zero duration is refused with a GraphQL error").isNotEmpty();
        assertThat(zero.getFirst().getMessage()).as("The refusal names the rule").containsIgnoringCase("positive");
    }

    @AfterAll
    public static void cleanup() {
        try {
            TimeTrackingApi.cancelTimer();
        } catch (RuntimeException ignored) {
            // best effort
        }
        for (String id : createdEntryIds) {
            try {
                TimeTrackingApi.deleteTimeEntry(id);
            } catch (RuntimeException ignored) {
                // best effort: a failed cleanup must not mask the case that failed
            }
        }
    }

    private static void requireUser() {
        assumeTrue(userGlobalId != null,
                "The user id comes from \"Run a timer through pause, resume and stop\"; see that failure");
    }
}
