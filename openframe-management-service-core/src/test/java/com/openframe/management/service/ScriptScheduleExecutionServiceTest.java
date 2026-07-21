package com.openframe.management.service;

import com.openframe.data.document.rmm.ExecutionStatus;
import com.openframe.data.document.rmm.PrivilegeLevel;
import com.openframe.data.document.rmm.ScheduleScriptExecution;
import com.openframe.data.document.rmm.Script;
import com.openframe.data.document.rmm.ScriptExecution;
import com.openframe.data.document.rmm.ScriptSchedule;
import com.openframe.data.document.rmm.ScriptScheduleMachineAssigned;
import com.openframe.data.document.rmm.ScriptShell;
import com.openframe.data.document.rmm.ScriptStatus;
import com.openframe.data.nats.rmm.model.ScriptScheduleExecutionMessage;
import com.openframe.data.nats.rmm.publisher.ScriptScheduleExecutionNatsPublisher;
import com.openframe.data.repository.rmm.ScheduleScriptExecutionRepository;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import com.openframe.data.repository.rmm.ScriptRepository;
import com.openframe.data.repository.rmm.ScriptScheduleMachineAssignedRepository;
import com.openframe.data.repository.rmm.ScriptScheduleRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Locks the time-driven schedule runner's batch wire shape: one executionId per
 * schedule fire (shared across scripts + machines), a header row per fire,
 * per-(script, machine) leaves persisted RUNNING before publish, and ONE
 * batched NATS message per machine (all scripts in one payload). Also covers
 * fire-once missed-run collapse, one-shot clearing, and safe no-op advance
 * when there is nothing to dispatch.
 */
@ExtendWith(MockitoExtension.class)
class ScriptScheduleExecutionServiceTest {

    private static final String TENANT = "tenant-1";
    private static final String SCHEDULE_ID = "sched-1";
    private static final String OWNER = "user-1";

    @Mock private ScriptScheduleRepository scheduleRepository;
    @Mock private ScriptScheduleMachineAssignedRepository assignedRepository;
    @Mock private ScriptRepository scriptRepository;
    @Mock private ScriptExecutionRepository scriptExecutionRepository;
    @Mock private ScheduleScriptExecutionRepository scheduleScriptExecutionRepository;
    @Mock private ScriptScheduleExecutionNatsPublisher scriptScheduleExecutionNatsPublisher;

    private ScriptScheduleExecutionService service;

    @org.junit.jupiter.api.BeforeEach
    void setUp() {
        service = new ScriptScheduleExecutionService(
                scheduleRepository, assignedRepository, scriptRepository,
                scriptExecutionRepository, scheduleScriptExecutionRepository,
                scriptScheduleExecutionNatsPublisher);
    }

    @Test
    @DisplayName("no due schedules: nothing dispatched, nothing saved")
    void noDueSchedules() {
        when(scheduleRepository.findByStatusAndNextRunAtLessThanEqual(eq(ScriptStatus.ACTIVE), any()))
                .thenReturn(List.of());

        service.runDueSchedules();

        verifyNoInteractions(assignedRepository, scriptRepository, scriptExecutionRepository,
                scheduleScriptExecutionRepository, scriptScheduleExecutionNatsPublisher);
        verify(scheduleRepository, never()).save(any());
    }

    @Test
    @DisplayName("due schedule: header persisted RUNNING, leaves per (script, machine), ONE batched message per machine")
    void dueScheduleFansOutOneBatchPerMachine() {
        Instant now = Instant.now();
        ScriptSchedule schedule = schedule(now.minusSeconds(5), 60L, List.of("script-a", "script-b"));
        when(scheduleRepository.findByStatusAndNextRunAtLessThanEqual(eq(ScriptStatus.ACTIVE), any()))
                .thenReturn(List.of(schedule));
        when(assignedRepository.findByTenantIdAndScriptScheduleIdsContaining(TENANT, SCHEDULE_ID))
                .thenReturn(Optional.of(assigned(List.of("m1", "m2"))));
        when(scriptRepository.findByTenantIdAndIdIn(eq(TENANT), any()))
                .thenReturn(List.of(script("script-a", ScriptShell.BASH), script("script-b", ScriptShell.POWERSHELL)));

        service.runDueSchedules();

        // 1. Header row saved BEFORE leaves+publish, RUNNING, snapshotting the run.
        ArgumentCaptor<ScheduleScriptExecution> headerCaptor = ArgumentCaptor.forClass(ScheduleScriptExecution.class);
        verify(scheduleScriptExecutionRepository).save(headerCaptor.capture());
        ScheduleScriptExecution header = headerCaptor.getValue();
        assertThat(header.getTenantId()).isEqualTo(TENANT);
        assertThat(header.getScheduleId()).isEqualTo(SCHEDULE_ID);
        assertThat(header.getInitiatedBy()).isEqualTo(OWNER);
        assertThat(header.getStatus()).isEqualTo(ExecutionStatus.RUNNING);
        assertThat(header.getScriptIds()).containsExactly("script-a", "script-b");
        assertThat(header.getMachineIds()).containsExactly("m1", "m2");
        assertThat(header.getDispatchedAt()).isNotNull();
        String runExecutionId = header.getExecutionId();
        assertThat(runExecutionId).isNotBlank();

        // 2. Leaves: 2 scripts x 2 machines = 4 rows in a single saveAll batch, all
        //    RUNNING, all sharing the header's executionId + scheduleId.
        ArgumentCaptor<List<ScriptExecution>> rowsCaptor = ArgumentCaptor.forClass(List.class);
        verify(scriptExecutionRepository).saveAll(rowsCaptor.capture());
        List<ScriptExecution> allRows = rowsCaptor.getValue();
        assertThat(allRows).hasSize(4);
        assertThat(allRows).allSatisfy(r -> {
            assertThat(r.getTenantId()).isEqualTo(TENANT);
            assertThat(r.getStatus()).isEqualTo(ExecutionStatus.RUNNING);
            assertThat(r.getInitiatedBy()).isEqualTo(OWNER);
            assertThat(r.getDispatchedAt()).isNotNull();
            assertThat(r.getScheduleId()).isEqualTo(SCHEDULE_ID);
            assertThat(r.getExecutionId()).isEqualTo(runExecutionId);
        });
        assertThat(allRows).extracting(ScriptExecution::getScriptId).containsExactlyInAnyOrder(
                "script-a", "script-a", "script-b", "script-b");

        // 3. Wire: ONE batched message per machine (2 machines → 2 publishes), each
        //    carrying BOTH scripts under the shared executionId and scheduleId.
        ArgumentCaptor<ScriptScheduleExecutionMessage> msgCaptor =
                ArgumentCaptor.forClass(ScriptScheduleExecutionMessage.class);
        verify(scriptScheduleExecutionNatsPublisher, times(2)).publish(anyString(), msgCaptor.capture());
        assertThat(msgCaptor.getAllValues()).allSatisfy(m -> {
            assertThat(m.getScheduleId()).isEqualTo(SCHEDULE_ID);
            assertThat(m.getExecutionId()).isEqualTo(runExecutionId);
            assertThat(m.getInitiatedBy()).isEqualTo(OWNER);
            assertThat(m.getScripts()).extracting(s -> s.getScriptId())
                    .containsExactly("script-a", "script-b");
        });
        assertThat(msgCaptor.getAllValues()).extracting(ScriptScheduleExecutionMessage::getMachineId)
                .containsExactlyInAnyOrder("m1", "m2");
    }

    @Test
    @DisplayName("recurring: nextRunAt rolls forward to the next slot strictly after now (missed runs collapse to one)")
    void advancesNextRunForwardPastNow() {
        Instant now = Instant.now();
        // nextRunAt is 3.5 intervals in the past — should collapse to a single future slot.
        // interval 1800s (30 min); staleNext 6300s ago (105 min = 3.5 intervals).
        Instant staleNext = now.minus(Duration.ofSeconds(6300));
        ScriptSchedule schedule = schedule(staleNext, 1800L, List.of());
        when(scheduleRepository.findByStatusAndNextRunAtLessThanEqual(eq(ScriptStatus.ACTIVE), any()))
                .thenReturn(List.of(schedule));

        service.runDueSchedules();

        ArgumentCaptor<ScriptSchedule> saved = ArgumentCaptor.forClass(ScriptSchedule.class);
        verify(scheduleRepository).save(saved.capture());
        Instant next = saved.getValue().getNextRunAt();
        assertThat(next).isAfter(now);
        // Landed on a 30-min-grid slot, within one interval of now.
        assertThat(next).isBeforeOrEqualTo(now.plus(Duration.ofSeconds(1800)));
        assertThat(saved.getValue().getLastRunAt()).isNotNull();
        // No scripts/devices -> nothing dispatched anywhere.
        verifyNoInteractions(scriptExecutionRepository, scheduleScriptExecutionRepository,
                scriptScheduleExecutionNatsPublisher);
    }

    @Test
    @DisplayName("one-shot (null interval): fires once then nextRunAt is cleared")
    void oneShotClearsNextRun() {
        Instant now = Instant.now();
        ScriptSchedule schedule = schedule(now.minusSeconds(1), (Long) null, List.of());
        when(scheduleRepository.findByStatusAndNextRunAtLessThanEqual(eq(ScriptStatus.ACTIVE), any()))
                .thenReturn(List.of(schedule));

        service.runDueSchedules();

        ArgumentCaptor<ScriptSchedule> saved = ArgumentCaptor.forClass(ScriptSchedule.class);
        verify(scheduleRepository).save(saved.capture());
        assertThat(saved.getValue().getNextRunAt()).isNull();
    }

    private static ScriptSchedule schedule(Instant nextRunAt, Long intervalSeconds, List<String> scriptIds) {
        return ScriptSchedule.builder()
                .id(SCHEDULE_ID)
                .tenantId(TENANT)
                .name("sched")
                .status(ScriptStatus.ACTIVE)
                .createdBy(OWNER)
                .scriptIds(scriptIds)
                .startAt(nextRunAt)
                .repeat(intervalSeconds)
                .nextRunAt(nextRunAt)
                .build();
    }

    private static ScriptScheduleMachineAssigned assigned(List<String> machineIds) {
        return ScriptScheduleMachineAssigned.builder()
                .tenantId(TENANT)
                .scriptScheduleIds(List.of(SCHEDULE_ID))
                .machineIds(machineIds)
                .build();
    }

    private static Script script(String id, ScriptShell shell) {
        return Script.builder()
                .id(id)
                .tenantId(TENANT)
                .name(id)
                .shell(shell)
                .privilegeLevel(PrivilegeLevel.USER)
                .scriptBody("echo " + id)
                .defaultTimeoutSeconds(120)
                .status(ScriptStatus.ACTIVE)
                .build();
    }
}
