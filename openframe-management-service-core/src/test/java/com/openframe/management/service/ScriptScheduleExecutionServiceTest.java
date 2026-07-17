package com.openframe.management.service;

import com.openframe.data.document.rmm.ExecutionStatus;
import com.openframe.data.document.rmm.PrivilegeLevel;
import com.openframe.data.document.rmm.Script;
import com.openframe.data.document.rmm.ScriptExecution;
import com.openframe.data.document.rmm.ScriptSchedule;
import com.openframe.data.document.rmm.ScriptScheduleMachineAssigned;
import com.openframe.data.document.rmm.ScriptShell;
import com.openframe.data.document.rmm.ScriptStatus;
import com.openframe.data.nats.rmm.model.ScriptMessage;
import com.openframe.data.nats.rmm.publisher.ScriptNatsPublisher;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import com.openframe.data.repository.rmm.ScriptRepository;
import com.openframe.data.repository.rmm.ScriptScheduleMachineAssignedRepository;
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
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Locks the time-driven schedule runner: one executionId per script (scheduleId
 * stamped, RUNNING rows persisted before publish), fire-once missed-run collapse,
 * one-shot clearing, and safe no-op advance when there is nothing to dispatch.
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
    @Mock private ScriptNatsPublisher scriptNatsPublisher;

    private ScriptScheduleExecutionService service;

    @BeforeEach
    void setUp() {
        service = new ScriptScheduleExecutionService(
                scheduleRepository, assignedRepository, scriptRepository,
                scriptExecutionRepository, scriptNatsPublisher);
    }

    @Test
    @DisplayName("no due schedules: nothing dispatched, nothing saved")
    void noDueSchedules() {
        when(scheduleRepository.findByStatusAndNextRunAtLessThanEqual(eq(ScriptStatus.ACTIVE), any()))
                .thenReturn(List.of());

        service.runDueSchedules();

        verifyNoInteractions(assignedRepository, scriptRepository, scriptExecutionRepository, scriptNatsPublisher);
        verify(scheduleRepository, never()).save(any());
    }

    @Test
    @DisplayName("due schedule: ONE executionId shared across all scripts and machines; scheduleId + scriptId stamped; RUNNING rows persisted")
    void dueScheduleFansOutUnderOneExecutionId() {
        Instant now = Instant.now();
        ScriptSchedule schedule = schedule(now.minusSeconds(5), 60, List.of("script-a", "script-b"));
        when(scheduleRepository.findByStatusAndNextRunAtLessThanEqual(eq(ScriptStatus.ACTIVE), any()))
                .thenReturn(List.of(schedule));
        when(assignedRepository.findByTenantIdAndScriptScheduleIdsContaining(TENANT, SCHEDULE_ID))
                .thenReturn(Optional.of(assigned(List.of("m1", "m2"))));
        when(scriptRepository.findByTenantIdAndIdIn(eq(TENANT), any()))
                .thenReturn(List.of(script("script-a", ScriptShell.BASH), script("script-b", ScriptShell.POWERSHELL)));

        service.runDueSchedules();

        // 2 scripts x 2 machines = 4 rows across 2 saveAll batches, 4 messages.
        ArgumentCaptor<List<ScriptExecution>> rowsCaptor = ArgumentCaptor.forClass(List.class);
        verify(scriptExecutionRepository, org.mockito.Mockito.times(2)).saveAll(rowsCaptor.capture());
        List<ScriptExecution> allRows = rowsCaptor.getAllValues().stream().flatMap(List::stream).toList();
        assertThat(allRows).hasSize(4);
        assertThat(allRows).allSatisfy(r -> {
            assertThat(r.getTenantId()).isEqualTo(TENANT);
            assertThat(r.getStatus()).isEqualTo(ExecutionStatus.RUNNING);
            assertThat(r.getInitiatedBy()).isEqualTo(OWNER);
            assertThat(r.getDispatchedAt()).isNotNull();
        });
        // The WHOLE run shares one executionId; scriptId is what differs per script.
        assertThat(allRows).extracting(ScriptExecution::getExecutionId).containsOnly(allRows.get(0).getExecutionId());
        assertThat(allRows).extracting(ScriptExecution::getScriptId).containsExactlyInAnyOrder(
                "script-a", "script-a", "script-b", "script-b");

        ArgumentCaptor<ScriptMessage> msgCaptor = ArgumentCaptor.forClass(ScriptMessage.class);
        verify(scriptNatsPublisher, org.mockito.Mockito.times(4)).publishScript(anyString(), msgCaptor.capture());
        String runExecutionId = allRows.get(0).getExecutionId();
        assertThat(msgCaptor.getAllValues()).allSatisfy(m -> {
            assertThat(m.getScheduleId()).isEqualTo(SCHEDULE_ID);
            assertThat(m.getExecutionId()).isEqualTo(runExecutionId);
            assertThat(m.getScriptId()).isNotNull();
        });
        assertThat(msgCaptor.getAllValues()).extracting(ScriptMessage::getScriptId)
                .containsExactlyInAnyOrder("script-a", "script-a", "script-b", "script-b");
    }

    @Test
    @DisplayName("recurring: nextRunAt rolls forward to the next slot strictly after now (missed runs collapse to one)")
    void advancesNextRunForwardPastNow() {
        Instant now = Instant.now();
        // nextRunAt is 3.5 intervals in the past — should collapse to a single future slot.
        Instant staleNext = now.minus(Duration.ofMinutes(105));
        ScriptSchedule schedule = schedule(staleNext, 30, List.of());
        when(scheduleRepository.findByStatusAndNextRunAtLessThanEqual(eq(ScriptStatus.ACTIVE), any()))
                .thenReturn(List.of(schedule));
        when(assignedRepository.findByTenantIdAndScriptScheduleIdsContaining(TENANT, SCHEDULE_ID))
                .thenReturn(Optional.empty());

        service.runDueSchedules();

        ArgumentCaptor<ScriptSchedule> saved = ArgumentCaptor.forClass(ScriptSchedule.class);
        verify(scheduleRepository).save(saved.capture());
        Instant next = saved.getValue().getNextRunAt();
        assertThat(next).isAfter(now);
        // Landed on a 30-min-grid slot, within one interval of now.
        assertThat(next).isBeforeOrEqualTo(now.plus(Duration.ofMinutes(30)));
        assertThat(saved.getValue().getLastRunAt()).isNotNull();
        // No scripts/devices -> nothing dispatched.
        verifyNoInteractions(scriptExecutionRepository, scriptNatsPublisher);
    }

    @Test
    @DisplayName("one-shot (null interval): fires once then nextRunAt is cleared")
    void oneShotClearsNextRun() {
        Instant now = Instant.now();
        ScriptSchedule schedule = schedule(now.minusSeconds(1), null, List.of());
        when(scheduleRepository.findByStatusAndNextRunAtLessThanEqual(eq(ScriptStatus.ACTIVE), any()))
                .thenReturn(List.of(schedule));
        when(assignedRepository.findByTenantIdAndScriptScheduleIdsContaining(TENANT, SCHEDULE_ID))
                .thenReturn(Optional.empty());

        service.runDueSchedules();

        ArgumentCaptor<ScriptSchedule> saved = ArgumentCaptor.forClass(ScriptSchedule.class);
        verify(scheduleRepository).save(saved.capture());
        assertThat(saved.getValue().getNextRunAt()).isNull();
    }

    private static ScriptSchedule schedule(Instant nextRunAt, Integer intervalMinutes, List<String> scriptIds) {
        return ScriptSchedule.builder()
                .id(SCHEDULE_ID)
                .tenantId(TENANT)
                .name("sched")
                .status(ScriptStatus.ACTIVE)
                .createdBy(OWNER)
                .scriptIds(scriptIds)
                .startAt(nextRunAt)
                .repeatIntervalMinutes(intervalMinutes)
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
