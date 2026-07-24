package com.openframe.client.service;

import com.openframe.client.service.rmm.ScheduleFireDispatcher;
import com.openframe.data.document.rmm.ExecutionStatus;
import com.openframe.data.document.rmm.PrivilegeLevel;
import com.openframe.data.document.rmm.ScheduleScriptExecution;
import com.openframe.data.document.rmm.Script;
import com.openframe.data.document.rmm.ScriptExecution;
import com.openframe.data.document.rmm.ScriptSchedule;
import com.openframe.data.document.rmm.ScriptScheduleMachineAssigned;
import com.openframe.data.document.rmm.ScriptShell;
import com.openframe.data.document.rmm.ScriptStatus;
import com.openframe.data.nats.rmm.model.ScriptScheduleExecutionItem;
import com.openframe.data.nats.rmm.model.ScriptScheduleExecutionMessage;
import com.openframe.data.nats.rmm.publisher.ScriptScheduleExecutionNatsPublisher;
import com.openframe.data.repository.rmm.ScheduleScriptExecutionRepository;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import com.openframe.data.repository.rmm.ScriptRepository;
import com.openframe.data.repository.rmm.ScriptScheduleMachineAssignedRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

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
 * Locks the batch wire shape of one schedule fire: one executionId (shared across scripts +
 * machines), a header row, per-(script, machine) leaves persisted RUNNING before publish, and
 * ONE batched NATS message per machine. Plus the "nothing to dispatch" no-ops.
 */
@ExtendWith(MockitoExtension.class)
class ScheduleFireDispatcherTest {

    private static final String TENANT = "tenant-1";
    private static final String SCHEDULE_ID = "sched-1";
    private static final String OWNER = "user-1";

    @Mock private ScriptScheduleMachineAssignedRepository assignedRepository;
    @Mock private ScriptRepository scriptRepository;
    @Mock private ScriptExecutionRepository scriptExecutionRepository;
    @Mock private ScheduleScriptExecutionRepository scheduleScriptExecutionRepository;
    @Mock private ScriptScheduleExecutionNatsPublisher scriptScheduleExecutionNatsPublisher;

    private ScheduleFireDispatcher dispatcher;

    @BeforeEach
    void setUp() {
        dispatcher = new ScheduleFireDispatcher(assignedRepository, scriptRepository,
                scriptExecutionRepository, scheduleScriptExecutionRepository, scriptScheduleExecutionNatsPublisher);
    }

    @Test
    @DisplayName("dispatch: header persisted RUNNING, leaves per (script, machine), ONE batched message per machine")
    void dispatch_fansOutOneBatchPerMachine() {
        Instant now = Instant.now();
        ScriptSchedule schedule = schedule(List.of("script-a", "script-b"));
        when(assignedRepository.findByTenantIdAndScriptScheduleId(TENANT, SCHEDULE_ID))
                .thenReturn(Optional.of(assigned(List.of("m1", "m2"))));
        when(scriptRepository.findByTenantIdAndIdIn(eq(TENANT), any()))
                .thenReturn(List.of(script("script-a", ScriptShell.BASH), script("script-b", ScriptShell.POWERSHELL)));

        dispatcher.dispatch(schedule, now);

        // 1. Header row — RUNNING, snapshotting the run.
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

        // 2. Leaves: 2 scripts x 2 machines = 4 rows in one saveAll, all RUNNING, shared executionId + scheduleId.
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

        // 3. Wire: ONE batched message per machine (2 machines → 2 publishes), each with BOTH scripts.
        ArgumentCaptor<ScriptScheduleExecutionMessage> msgCaptor =
                ArgumentCaptor.forClass(ScriptScheduleExecutionMessage.class);
        verify(scriptScheduleExecutionNatsPublisher, times(2)).publish(anyString(), msgCaptor.capture());
        assertThat(msgCaptor.getAllValues()).allSatisfy(m -> {
            assertThat(m.getScheduleId()).isEqualTo(SCHEDULE_ID);
            assertThat(m.getExecutionId()).isEqualTo(runExecutionId);
            assertThat(m.getInitiatedBy()).isEqualTo(OWNER);
            assertThat(m.getScripts()).extracting(ScriptScheduleExecutionItem::getScriptId)
                    .containsExactly("script-a", "script-b");
        });
        assertThat(msgCaptor.getAllValues()).extracting(ScriptScheduleExecutionMessage::getMachineId)
                .containsExactlyInAnyOrder("m1", "m2");
    }

    @Test
    @DisplayName("dispatch: no scripts or no assigned devices → nothing persisted or published")
    void dispatch_noScriptsOrDevices_isNoOp() {
        when(assignedRepository.findByTenantIdAndScriptScheduleId(TENANT, SCHEDULE_ID))
                .thenReturn(Optional.empty());   // no devices

        dispatcher.dispatch(schedule(List.of("script-a")), Instant.now());

        verifyNoInteractions(scriptRepository, scriptExecutionRepository,
                scheduleScriptExecutionRepository, scriptScheduleExecutionNatsPublisher);
    }

    @Test
    @DisplayName("dispatch: all referenced scripts missing/inactive → resolved but nothing dispatched")
    void dispatch_noRunnableScripts_isNoOp() {
        when(assignedRepository.findByTenantIdAndScriptScheduleId(TENANT, SCHEDULE_ID))
                .thenReturn(Optional.of(assigned(List.of("m1"))));
        when(scriptRepository.findByTenantIdAndIdIn(eq(TENANT), any())).thenReturn(List.of());   // none resolve

        dispatcher.dispatch(schedule(List.of("gone")), Instant.now());

        verify(scheduleScriptExecutionRepository, never()).save(any());
        verify(scriptExecutionRepository, never()).saveAll(any());
        verifyNoInteractions(scriptScheduleExecutionNatsPublisher);
    }

    @Test
    @DisplayName("dispatch: a combined '-Name value' defaultArg is tokenized into separate argv tokens on the wire")
    void dispatch_tokenizesCombinedArgs() {
        when(assignedRepository.findByTenantIdAndScriptScheduleId(TENANT, SCHEDULE_ID))
                .thenReturn(Optional.of(assigned(List.of("m1"))));
        Script withArgs = Script.builder()
                .id("script-a").tenantId(TENANT).name("script-a").shell(ScriptShell.POWERSHELL)
                .privilegeLevel(PrivilegeLevel.USER).scriptBody("param($Bucket)")
                .defaultArgs(List.of("-Bucket BGCSouthVancouverIsland"))
                .defaultTimeoutSeconds(120).status(ScriptStatus.ACTIVE).build();
        when(scriptRepository.findByTenantIdAndIdIn(eq(TENANT), any())).thenReturn(List.of(withArgs));

        dispatcher.dispatch(schedule(List.of("script-a")), Instant.now());

        ArgumentCaptor<ScriptScheduleExecutionMessage> msgCaptor =
                ArgumentCaptor.forClass(ScriptScheduleExecutionMessage.class);
        verify(scriptScheduleExecutionNatsPublisher).publish(anyString(), msgCaptor.capture());
        assertThat(msgCaptor.getValue().getScripts().get(0).getArgs())
                .containsExactly("-Bucket", "BGCSouthVancouverIsland");   // name no longer leaks into the value
    }

    @Test
    @DisplayName("dispatch(schedule, machineIds, now): fires to exactly the given machines, bypassing the assignment lookup (DEVICE_ONLINE path)")
    void dispatch_toSpecificMachines_bypassesAssignmentLookup() {
        ScriptSchedule schedule = schedule(List.of("script-a"));
        when(scriptRepository.findByTenantIdAndIdIn(eq(TENANT), any()))
                .thenReturn(List.of(script("script-a", ScriptShell.POWERSHELL)));

        dispatcher.dispatch(schedule, List.of("m9"), Instant.now());

        verifyNoInteractions(assignedRepository);   // caller supplied the machine; no reverse lookup
        ArgumentCaptor<ScriptScheduleExecutionMessage> msgCaptor =
                ArgumentCaptor.forClass(ScriptScheduleExecutionMessage.class);
        verify(scriptScheduleExecutionNatsPublisher).publish(anyString(), msgCaptor.capture());
        assertThat(msgCaptor.getValue().getMachineId()).isEqualTo("m9");
    }

    private static ScriptSchedule schedule(List<String> scriptIds) {
        return ScriptSchedule.builder()
                .id(SCHEDULE_ID)
                .tenantId(TENANT)
                .name("sched")
                .status(ScriptStatus.ACTIVE)
                .createdBy(OWNER)
                .scriptIds(scriptIds)
                .build();
    }

    private static ScriptScheduleMachineAssigned assigned(List<String> machineIds) {
        return ScriptScheduleMachineAssigned.builder()
                .tenantId(TENANT)
                .scriptScheduleId(SCHEDULE_ID)
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
