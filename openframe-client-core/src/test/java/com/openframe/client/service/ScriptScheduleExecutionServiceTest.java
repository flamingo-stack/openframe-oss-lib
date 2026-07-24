package com.openframe.client.service;

import com.openframe.client.service.rmm.ScheduleFireDispatcher;
import com.openframe.client.service.rmm.ScriptScheduleExecutionService;
import com.openframe.data.document.rmm.ScriptSchedule;
import com.openframe.data.document.rmm.ScriptStatus;
import com.openframe.data.repository.rmm.ScriptScheduleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Orchestration + cadence: the due sweep, per-schedule error isolation, lastRunAt/nextRunAt
 * bookkeeping, and the roll-forward math. Firing is mocked ({@link ScheduleFireDispatcher} has
 * its own test) so these assertions stay on the schedule-state transitions.
 */
@ExtendWith(MockitoExtension.class)
class ScriptScheduleExecutionServiceTest {

    private static final String SCHEDULE_ID = "sched-1";

    @Mock private ScriptScheduleRepository scheduleRepository;
    @Mock private ScheduleFireDispatcher fireDispatcher;

    private ScriptScheduleExecutionService service;

    @BeforeEach
    void setUp() {
        service = new ScriptScheduleExecutionService(scheduleRepository, fireDispatcher);
    }

    @Test
    @DisplayName("no due schedules: nothing fired, nothing saved")
    void noDueSchedules() {
        when(scheduleRepository.findByStatusAndNextRunAtLessThanEqual(eq(ScriptStatus.ACTIVE), any()))
                .thenReturn(List.of());

        service.runDueSchedules();

        verifyNoInteractions(fireDispatcher);
        verify(scheduleRepository, never()).save(any());
    }

    @Test
    @DisplayName("due recurring schedule: fired, lastRunAt stamped, nextRunAt rolled to the next slot after now (missed intervals collapse to one)")
    void dueSchedule_firesThenAdvancesCadence() {
        Instant now = Instant.now();
        // nextRunAt 3.5 intervals in the past; interval 1800s (30 min).
        ScriptSchedule schedule = due(now.minus(Duration.ofSeconds(6300)), 1800L);
        when(scheduleRepository.findByStatusAndNextRunAtLessThanEqual(eq(ScriptStatus.ACTIVE), any()))
                .thenReturn(List.of(schedule));

        service.runDueSchedules();

        verify(fireDispatcher).dispatch(eq(schedule), any());
        ArgumentCaptor<ScriptSchedule> saved = ArgumentCaptor.forClass(ScriptSchedule.class);
        verify(scheduleRepository).save(saved.capture());
        assertThat(saved.getValue().getLastRunAt()).isNotNull();                 // a successful fire stamps lastRunAt
        Instant next = saved.getValue().getNextRunAt();
        assertThat(next).isAfter(now);                                           // single future slot,
        assertThat(next).isBeforeOrEqualTo(now.plus(Duration.ofSeconds(1800)));  // within one interval
    }

    @Test
    @DisplayName("one-shot (null interval): fires once, then nextRunAt is cleared")
    void oneShot_clearsNextRun() {
        ScriptSchedule schedule = due(Instant.now().minusSeconds(1), null);
        when(scheduleRepository.findByStatusAndNextRunAtLessThanEqual(eq(ScriptStatus.ACTIVE), any()))
                .thenReturn(List.of(schedule));

        service.runDueSchedules();

        ArgumentCaptor<ScriptSchedule> saved = ArgumentCaptor.forClass(ScriptSchedule.class);
        verify(scheduleRepository).save(saved.capture());
        assertThat(saved.getValue().getNextRunAt()).isNull();
    }

    @Test
    @DisplayName("one broken schedule does not wedge the sweep: cadence still advances + saves, but lastRunAt is NOT stamped, and the next schedule still fires")
    void dispatchFailure_stillAdvancesButDoesNotStampLastRun() {
        Instant now = Instant.now();
        ScriptSchedule broken = due(now.minusSeconds(1), 1800L);
        broken.setId("broken");
        ScriptSchedule ok = due(now.minusSeconds(1), 1800L);
        ok.setId("ok");
        when(scheduleRepository.findByStatusAndNextRunAtLessThanEqual(eq(ScriptStatus.ACTIVE), any()))
                .thenReturn(List.of(broken, ok));
        doThrow(new RuntimeException("nats down")).when(fireDispatcher).dispatch(eq(broken), any());

        service.runDueSchedules();

        // Broken one: cadence advanced + saved, but NOT marked as run.
        assertThat(broken.getNextRunAt()).isAfter(now);
        assertThat(broken.getLastRunAt()).isNull();
        verify(scheduleRepository).save(broken);
        // The good one still fired despite the earlier failure.
        verify(fireDispatcher).dispatch(eq(ok), any());
        assertThat(ok.getLastRunAt()).isNotNull();
        verify(scheduleRepository).save(ok);
    }

    private static ScriptSchedule due(Instant nextRunAt, Long repeat) {
        return ScriptSchedule.builder()
                .id(SCHEDULE_ID)
                .tenantId("tenant-1")
                .name("sched")
                .status(ScriptStatus.ACTIVE)
                .repeat(repeat)
                .nextRunAt(nextRunAt)
                .build();
    }
}
