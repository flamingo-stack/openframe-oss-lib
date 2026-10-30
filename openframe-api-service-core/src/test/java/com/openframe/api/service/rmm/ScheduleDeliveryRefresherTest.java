package com.openframe.api.service.rmm;

import com.openframe.api.service.rmm.schedule.ScheduleDeliveryRefresher;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.rmm.schedule.ScheduleScript;
import com.openframe.data.document.rmm.schedule.ScheduledScriptCustomParams;
import com.openframe.data.document.rmm.script.ExecutionStatus;
import com.openframe.data.document.rmm.script.Script;
import com.openframe.data.document.rmm.script.ScriptExecution;
import com.openframe.data.document.rmm.script.ScriptShell;
import com.openframe.data.document.rmm.script.ScriptStatus;
import com.openframe.data.nats.rmm.model.ScriptScheduleExecutionItem;
import com.openframe.data.nats.rmm.model.ScriptScheduleExecutionMessage;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import com.openframe.data.repository.rmm.ScriptRepository;
import com.openframe.data.repository.rmm.ScriptScheduleRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.delivery.dispatch.DeliveryRefresher;
import com.openframe.delivery.track.DeliveryTracker;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ScheduleDeliveryRefresherTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String SCHEDULE_ID = "sched-1";
    private static final String EXECUTION_ID = "exec-1";
    private static final String OTHER_EXECUTION_ID = "exec-2";
    private static final String SCRIPT_A = "script-a";
    private static final String SCRIPT_B = "script-b";
    private static final String MACHINE_1 = "m-1";
    private static final String MACHINE_2 = "m-2";
    private static final String OWNER = "user-1";
    private static final String REASON = "schedule deleted";

    @Mock private ScriptExecutionRepository scriptExecutionRepository;
    @Mock private ScriptScheduleRepository scheduleRepository;
    @Mock private ScriptRepository scriptRepository;
    @Mock private DeliveryRefresher deliveryRefresher;
    @Mock private DeliveryTracker deliveryTracker;
    @Mock private TenantIdProvider tenantIdProvider;
    @Captor private ArgumentCaptor<ScriptScheduleExecutionMessage> messageCaptor;

    private ScheduleDeliveryRefresher refresher;

    @BeforeEach
    void setUp() {
        refresher = new ScheduleDeliveryRefresher(scriptExecutionRepository, scheduleRepository, scriptRepository,
                deliveryRefresher, deliveryTracker, tenantIdProvider);
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
    }

    @Test
    @DisplayName("refreshForScript: every machine still waiting for a batch with the script gets the batch rebuilt from the scripts as they are now, in the schedule's order")
    void refreshForScript_waitingMachinesGetTheBatchAsItIsNow() {
        when(scriptExecutionRepository.findByTenantIdAndScriptIdAndStatus(TENANT_ID, SCRIPT_A, ExecutionStatus.QUEUED))
                .thenReturn(List.of(queued(EXECUTION_ID, MACHINE_1, SCRIPT_A), queued(EXECUTION_ID, MACHINE_2, SCRIPT_A)));
        when(scriptExecutionRepository.findByTenantIdAndExecutionId(TENANT_ID, EXECUTION_ID))
                .thenReturn(List.of(queued(EXECUTION_ID, MACHINE_1, SCRIPT_A), queued(EXECUTION_ID, MACHINE_1, SCRIPT_B),
                        queued(EXECUTION_ID, MACHINE_2, SCRIPT_A), queued(EXECUTION_ID, MACHINE_2, SCRIPT_B)));
        when(scheduleRepository.findByTenantIdAndId(TENANT_ID, SCHEDULE_ID)).thenReturn(Optional.of(schedule(ScriptStatus.ACTIVE, List.of(SCRIPT_B, SCRIPT_A))));
        when(scriptRepository.findByTenantIdAndIdIn(eq(TENANT_ID), any()))
                .thenReturn(List.of(script(SCRIPT_A, "echo a2"), script(SCRIPT_B, "echo b")));
        when(deliveryRefresher.refresh(eq(DeliveryType.SCRIPT_SCHEDULE), eq(EXECUTION_ID), anyString(), messageCaptor.capture())).thenReturn(true);

        refresher.refreshForScript(SCRIPT_A);

        verify(deliveryRefresher).refresh(eq(DeliveryType.SCRIPT_SCHEDULE), eq(EXECUTION_ID), eq(MACHINE_1), any());
        verify(deliveryRefresher).refresh(eq(DeliveryType.SCRIPT_SCHEDULE), eq(EXECUTION_ID), eq(MACHINE_2), any());
        ScriptScheduleExecutionMessage message = messageCaptor.getValue();
        assertThat(message.getExecutionId()).isEqualTo(EXECUTION_ID);
        assertThat(message.getScheduleId()).isEqualTo(SCHEDULE_ID);
        assertThat(message.getInitiatedBy()).isEqualTo(OWNER);
        assertThat(message.getMachineId()).isNull();
        assertThat(message.getScripts()).extracting(ScriptScheduleExecutionItem::getScriptId).containsExactly(SCRIPT_B, SCRIPT_A);
        assertThat(message.getScripts()).extracting(ScriptScheduleExecutionItem::getCode).containsExactly("echo b", "echo a2");
        assertThat(message.getScripts().get(1).getArgs()).containsExactly("--fast");
    }

    @Test
    @DisplayName("refreshForScript: a script of the fire that is gone since is left out of the rebuilt batch")
    void refreshForScript_scriptGoneSince_leftOutOfTheBatch() {
        when(scriptExecutionRepository.findByTenantIdAndScriptIdAndStatus(TENANT_ID, SCRIPT_A, ExecutionStatus.QUEUED))
                .thenReturn(List.of(queued(EXECUTION_ID, MACHINE_1, SCRIPT_A)));
        when(scriptExecutionRepository.findByTenantIdAndExecutionId(TENANT_ID, EXECUTION_ID))
                .thenReturn(List.of(queued(EXECUTION_ID, MACHINE_1, SCRIPT_A), queued(EXECUTION_ID, MACHINE_1, SCRIPT_B)));
        when(scheduleRepository.findByTenantIdAndId(TENANT_ID, SCHEDULE_ID)).thenReturn(Optional.of(schedule(ScriptStatus.ACTIVE, List.of(SCRIPT_A, SCRIPT_B))));
        Script deleted = script(SCRIPT_B, "echo b");
        deleted.setStatus(ScriptStatus.DELETED);
        when(scriptRepository.findByTenantIdAndIdIn(eq(TENANT_ID), any())).thenReturn(List.of(script(SCRIPT_A, "echo a"), deleted));
        when(deliveryRefresher.refresh(eq(DeliveryType.SCRIPT_SCHEDULE), eq(EXECUTION_ID), eq(MACHINE_1), messageCaptor.capture())).thenReturn(true);

        refresher.refreshForScript(SCRIPT_A);

        assertThat(messageCaptor.getValue().getScripts()).extracting(ScriptScheduleExecutionItem::getScriptId).containsExactly(SCRIPT_A);
    }

    @Test
    @DisplayName("refreshForSchedule: the schedule is no longer active → the waiting batches are left as they are")
    void refreshForSchedule_scheduleNotActive_nothingReplaced() {
        when(scriptExecutionRepository.findByTenantIdAndScheduleIdAndStatus(TENANT_ID, SCHEDULE_ID, ExecutionStatus.QUEUED))
                .thenReturn(List.of(queued(EXECUTION_ID, MACHINE_1, SCRIPT_A)));
        when(scheduleRepository.findByTenantIdAndId(TENANT_ID, SCHEDULE_ID)).thenReturn(Optional.of(schedule(ScriptStatus.ARCHIVED, List.of(SCRIPT_A))));

        refresher.refreshForSchedule(SCHEDULE_ID);

        verifyNoInteractions(deliveryRefresher, scriptRepository);
    }

    @Test
    @DisplayName("cancelForSchedule: one withdrawal per (fire, machine) still waiting, whatever the number of scripts")
    void cancelForSchedule_oneWithdrawalPerWaitingDelivery() {
        when(scriptExecutionRepository.findByTenantIdAndScheduleIdAndStatus(TENANT_ID, SCHEDULE_ID, ExecutionStatus.QUEUED))
                .thenReturn(List.of(queued(EXECUTION_ID, MACHINE_1, SCRIPT_A), queued(EXECUTION_ID, MACHINE_1, SCRIPT_B),
                        queued(OTHER_EXECUTION_ID, MACHINE_2, SCRIPT_A)));

        refresher.cancelForSchedule(SCHEDULE_ID, REASON);

        verify(deliveryTracker).cancel(DeliveryType.SCRIPT_SCHEDULE, EXECUTION_ID, MACHINE_1, REASON);
        verify(deliveryTracker).cancel(DeliveryType.SCRIPT_SCHEDULE, OTHER_EXECUTION_ID, MACHINE_2, REASON);
        verifyNoInteractions(deliveryRefresher);
    }

    @Test
    @DisplayName("cancelForMachines: only the removed machines' waiting batches are withdrawn")
    void cancelForMachines_onlyTheRemovedMachines() {
        when(scriptExecutionRepository.findByTenantIdAndScheduleIdAndStatus(TENANT_ID, SCHEDULE_ID, ExecutionStatus.QUEUED))
                .thenReturn(List.of(queued(EXECUTION_ID, MACHINE_1, SCRIPT_A), queued(EXECUTION_ID, MACHINE_2, SCRIPT_A)));

        refresher.cancelForMachines(SCHEDULE_ID, Set.of(MACHINE_2), REASON);

        verify(deliveryTracker).cancel(DeliveryType.SCRIPT_SCHEDULE, EXECUTION_ID, MACHINE_2, REASON);
        verify(deliveryTracker, never()).cancel(any(), any(), eq(MACHINE_1), any());
    }

    private static ScriptExecution queued(String executionId, String machineId, String scriptId) {
        return ScriptExecution.builder()
                .tenantId(TENANT_ID)
                .executionId(executionId)
                .scheduleId(SCHEDULE_ID)
                .machineId(machineId)
                .scriptId(scriptId)
                .initiatedBy(OWNER)
                .status(ExecutionStatus.QUEUED)
                .build();
    }

    private static ScheduleScript schedule(ScriptStatus status, List<String> scriptIds) {
        return ScheduleScript.builder()
                .id(SCHEDULE_ID)
                .tenantId(TENANT_ID)
                .status(status)
                .scriptIds(scriptIds)
                .scriptCustomParams(List.of(ScheduledScriptCustomParams.builder().scriptId(SCRIPT_A).args(List.of("--fast")).build()))
                .build();
    }

    private static Script script(String id, String body) {
        Script script = new Script();
        script.setId(id);
        script.setTenantId(TENANT_ID);
        script.setName(id);
        script.setShell(ScriptShell.BASH);
        script.setScriptBody(body);
        script.setStatus(ScriptStatus.ACTIVE);
        script.setDefaultTimeoutSeconds(60);
        return script;
    }
}
