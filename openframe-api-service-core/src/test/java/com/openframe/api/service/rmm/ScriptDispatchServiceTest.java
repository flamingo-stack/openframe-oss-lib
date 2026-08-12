package com.openframe.api.service.rmm;

import com.openframe.api.dto.rmm.DispatchResponse;
import com.openframe.api.dto.rmm.script.BatchRunScriptInput;
import com.openframe.api.dto.rmm.script.RunScriptInput;
import com.openframe.api.dto.rmm.script.ScriptEnvVarInput;
import com.openframe.api.dto.rmm.script.ScriptResponse;
import com.openframe.api.exception.DeviceNotFoundException;
import com.openframe.api.service.DeviceService;
import com.openframe.core.exception.BadRequestException;
import com.openframe.core.exception.ErrorCode;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.ExecutionSource;
import com.openframe.data.document.rmm.PrivilegeLevel;
import com.openframe.data.document.rmm.ScheduledScriptCustomParams;
import com.openframe.data.document.rmm.ScriptEnvVar;
import com.openframe.data.document.rmm.ScriptShell;
import com.openframe.data.nats.rmm.model.ScriptMessage;
import com.openframe.data.nats.rmm.model.ScriptScheduleExecutionItem;
import com.openframe.data.nats.rmm.model.ScriptScheduleExecutionMessage;
import com.openframe.data.nats.rmm.publisher.ScriptNatsPublisher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static com.openframe.data.document.rmm.ScriptShell.BASH;
import static com.openframe.data.document.rmm.ScriptStatus.ACTIVE;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ScriptDispatchServiceTest {

    private static final String MACHINE_ID = "machine-abc";
    private static final String SCRIPT_ID = "script-1";
    private static final String USER_ID = "user-mr-anderson";

    @Mock
    private ScriptService scriptService;
    @Mock
    private ScriptNatsPublisher scriptNatsPublisher;
    @Mock
    private DeviceService deviceService;
    @Mock
    private ScriptExecutionService scriptExecutionService;
    @Mock
    private com.openframe.data.nats.rmm.publisher.ScriptScheduleNatsPublisher scriptScheduleNatsPublisher;
    @Mock
    private ScriptScheduleService scriptScheduleService;
    @Mock
    private ScriptScheduleDeviceService scriptScheduleDeviceService;
    @Mock
    private com.openframe.data.repository.rmm.ScheduleScriptExecutionRepository scheduleScriptExecutionRepository;
    @Mock
    private com.openframe.data.service.TenantIdProvider tenantIdProvider;
    @Mock
    private ScriptTimeoutValidator timeoutValidator;

    @InjectMocks
    private ScriptDispatchService scriptDispatchService;

    private RunScriptInput input;

    @BeforeEach
    void setUp() {
        // Target machine exists (happy path). lenient: the not-found test re-stubs this,
        // and the machine check runs before script resolution.
        lenient().when(deviceService.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(new Machine()));

        // Saved script resolved from the tenant-scoped store.
        ScriptResponse script = ScriptResponse.builder()
                .id(SCRIPT_ID)
                .name("disk usage")
                .shell(BASH)
                .scriptBody("df -h")
                .defaultArgs(List.of("-a"))
                .defaultTimeoutSeconds(60)
                .envVars(List.of(ScriptEnvVarInput.builder().name("ENV").value("prod").secret(false).build()))
                .build();
        lenient().when(scriptService.get(SCRIPT_ID)).thenReturn(script);

        input = new RunScriptInput();
        input.setMachineId(MACHINE_ID);
        input.setScriptId(SCRIPT_ID);
        input.setPrivilegeLevel(PrivilegeLevel.ADMIN);
    }

    @Test
    @DisplayName("runScript: validates the timeout override first — a rejected timeout throws (400) and nothing is dispatched")
    void runScript_validatesTimeoutBeforeDispatch() {
        input.setTimeoutSeconds(700);
        doThrow(new BadRequestException(ErrorCode.VALIDATION_ERROR, "timeoutSeconds must not exceed 600 seconds"))
                .when(timeoutValidator).validate(700);

        assertThatThrownBy(() -> scriptDispatchService.runScript(input, "user-1", ExecutionSource.MANUAL))
                .isInstanceOf(BadRequestException.class);

        verify(timeoutValidator).validate(700);
        verifyNoInteractions(scriptNatsPublisher);
    }

    @Test
    @DisplayName("batchRunScript: validates the timeout override first — a rejected timeout throws (400) and nothing is dispatched")
    void batchRunScript_validatesTimeoutBeforeDispatch() {
        BatchRunScriptInput batch = new BatchRunScriptInput();
        batch.setMachineIds(List.of(MACHINE_ID));
        batch.setScriptId(SCRIPT_ID);
        batch.setPrivilegeLevel(PrivilegeLevel.ADMIN);
        batch.setTimeoutSeconds(700);
        doThrow(new BadRequestException(ErrorCode.VALIDATION_ERROR, "timeoutSeconds must not exceed 600 seconds"))
                .when(timeoutValidator).validate(700);

        assertThatThrownBy(() -> scriptDispatchService.batchRunScript(batch, "user-1", ExecutionSource.MANUAL))
                .isInstanceOf(BadRequestException.class);

        verify(timeoutValidator).validate(700);
        verifyNoInteractions(scriptNatsPublisher);
    }

    @Test
    @DisplayName("runScript: persists an Execution History row BEFORE publishing on NATS — RUNNING status, scriptId only (name resolved at read time), same executionId as wire + response. Order matters: if publish fails the row survives and the management watchdog resolves it later.")
    void runScript_persistsExecutionRowBeforeNatsPublish() {
        DispatchResponse response = scriptDispatchService.runScript(input, USER_ID, ExecutionSource.MANUAL);

        org.mockito.InOrder inOrder = inOrder(scriptExecutionService, scriptNatsPublisher);
        // Persist FIRST, publish SECOND. Locked in — the watchdog story depends on this.
        inOrder.verify(scriptExecutionService).create(
                eq(response.getExecutionId()),
                eq(SCRIPT_ID),
                eq(MACHINE_ID),
                eq(PrivilegeLevel.ADMIN),
                eq(60),                      // effective timeout (script default, no override) — persisted for the watchdog
                eq(USER_ID),
                eq(ExecutionSource.MANUAL));
        inOrder.verify(scriptNatsPublisher).publishScript(eq(MACHINE_ID), any(ScriptMessage.class));
    }

    @Test
    @DisplayName("runScript: a null initiatedBy is forwarded as-is — defensive fallback so an unauthenticated edge-case still produces a History row instead of NPE-ing")
    void runScript_nullInitiatedBy_persistedAsNull() {
        scriptDispatchService.runScript(input, null, ExecutionSource.MANUAL);

        verify(scriptExecutionService).create(
                any(String.class),
                eq(SCRIPT_ID),
                eq(MACHINE_ID),
                eq(PrivilegeLevel.ADMIN),
                eq(60),
                eq((String) null),
                eq(ExecutionSource.MANUAL));
    }

    @Test
    @DisplayName("runScript: resolves the saved script and builds an agent-shaped ScriptMessage — the SAME executionId is returned to the FE and carried in the wire payload (so the agent's result correlates back), plus machineId/code/shell/privilegeLevel/envVars verbatim")
    void runScript_resolvesScriptPublishesAndReturnsExecutionId() {
        DispatchResponse response = scriptDispatchService.runScript(input, USER_ID, ExecutionSource.MANUAL);

        assertThat(response.getExecutionId()).isNotBlank();

        ScriptMessage sent = capturePublished();
        // The wire payload MUST carry the same executionId returned to the FE — that is
        // what lets the agent's ScriptResultMessage correlate to this dispatch.
        assertThat(sent.getExecutionId()).isEqualTo(response.getExecutionId());
        assertThat(sent.getMachineId()).isEqualTo(MACHINE_ID);
        assertThat(sent.getCode()).isEqualTo("df -h");
        assertThat(sent.getShell()).isEqualTo(BASH);
        assertThat(sent.getPrivilegeLevel()).isEqualTo(PrivilegeLevel.ADMIN);
        assertThat(sent.getEnvVars())
                .singleElement()
                .satisfies(e -> {
                    assertThat(e.getName()).isEqualTo("ENV");
                    assertThat(e.getValue()).isEqualTo("prod");
                    assertThat(e.isSecret()).isFalse();
                });
    }

    @Test
    @DisplayName("runScript: with no overrides, args and timeoutSeconds fall back to the script's stored defaults")
    void runScript_usesScriptDefaultsWhenNoOverride() {
        scriptDispatchService.runScript(input, USER_ID, ExecutionSource.MANUAL);

        ScriptMessage sent = capturePublished();
        assertThat(sent.getArgs()).containsExactly("-a");
        assertThat(sent.getTimeoutSeconds()).isEqualTo(60);
    }

    @Test
    @DisplayName("runScript: a combined '-Name value' override arg is tokenized into separate argv tokens on the wire (fixes the name leaking into the value)")
    void runScript_tokenizesCombinedArgs() {
        input.setArgs(List.of("-Bucket BGCSouthVancouverIsland"));

        scriptDispatchService.runScript(input, USER_ID, ExecutionSource.MANUAL);

        ScriptMessage sent = capturePublished();
        assertThat(sent.getArgs()).containsExactly("-Bucket", "BGCSouthVancouverIsland");
    }

    @Test
    @DisplayName("runScript: input args and timeoutSeconds override the script's stored defaults")
    void runScript_overridesArgsAndTimeout() {
        input.setArgs(List.of("-x", "--verbose"));
        input.setTimeoutSeconds(90);

        scriptDispatchService.runScript(input, USER_ID, ExecutionSource.MANUAL);

        ScriptMessage sent = capturePublished();
        assertThat(sent.getArgs()).containsExactly("-x", "--verbose");
        assertThat(sent.getTimeoutSeconds()).isEqualTo(90);
    }

    @Test
    @DisplayName("runScript: the effective timeout (override wins over the script default) is persisted on the History row AND sent on the wire — same value, so the watchdog's threshold matches what the agent enforces")
    void runScript_persistsEffectiveTimeoutOnRow() {
        input.setTimeoutSeconds(90);   // override beats the script default (60)

        scriptDispatchService.runScript(input, USER_ID, ExecutionSource.MANUAL);

        verify(scriptExecutionService).create(
                any(String.class), eq(SCRIPT_ID), eq(MACHINE_ID), eq(PrivilegeLevel.ADMIN), eq(90), eq(USER_ID), eq(ExecutionSource.MANUAL));
        assertThat(capturePublished().getTimeoutSeconds()).isEqualTo(90);
    }

    @Test
    @DisplayName("runScript: input env vars are merged over the script's stored ones — a same-named var overrides, a new name is added; secret flag is preserved")
    void runScript_mergesAndOverridesEnvVars() {
        input.setEnvVars(List.of(
                ScriptEnvVarInput.builder().name("ENV").value("staging").secret(false).build(),   // overrides stored ENV=prod
                ScriptEnvVarInput.builder().name("TOKEN").value("xyz").secret(true).build()        // new var
        ));

        scriptDispatchService.runScript(input, USER_ID, ExecutionSource.MANUAL);

        ScriptMessage sent = capturePublished();
        assertThat(sent.getEnvVars())
                .extracting(ScriptEnvVar::getName, ScriptEnvVar::getValue, ScriptEnvVar::isSecret)
                .containsExactly(
                        // run-time value wins over the stored "prod"
                        org.assertj.core.groups.Tuple.tuple("ENV", "staging", false),
                        org.assertj.core.groups.Tuple.tuple("TOKEN", "xyz", true));
    }

    @Test
    @DisplayName("runScript: forwards the privilegeLevel (USER vs ADMIN) verbatim — from the input, not a backend default")
    void runScript_forwardsPrivilegeLevelVerbatim() {
        input.setPrivilegeLevel(PrivilegeLevel.USER);

        scriptDispatchService.runScript(input, USER_ID, ExecutionSource.MANUAL);

        assertThat(capturePublished().getPrivilegeLevel()).isEqualTo(PrivilegeLevel.USER);
    }

    @Test
    @DisplayName("runScript: each invocation generates a distinct executionId (returned to FE in DispatchResponse; not present in the wire payload)")
    void runScript_generatesDistinctExecutionIds() {
        String first = scriptDispatchService.runScript(input, USER_ID, ExecutionSource.MANUAL).getExecutionId();
        String second = scriptDispatchService.runScript(input, USER_ID, ExecutionSource.MANUAL).getExecutionId();
        String third = scriptDispatchService.runScript(input, USER_ID, ExecutionSource.MANUAL).getExecutionId();

        assertThat(List.of(first, second, third)).doesNotHaveDuplicates();
        verify(scriptNatsPublisher, times(3)).publishScript(eq(MACHINE_ID), any(ScriptMessage.class));
    }

    @Test
    @DisplayName("runScript: a non-existent machine is rejected (DeviceNotFoundException) — no Execution row is created and nothing is published. The machine check runs FIRST, before any persistence side-effect.")
    void runScript_rejectsUnknownMachine() {
        when(deviceService.findByMachineId(MACHINE_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> scriptDispatchService.runScript(input, USER_ID, ExecutionSource.MANUAL))
                .isInstanceOf(DeviceNotFoundException.class);

        verifyNoInteractions(scriptExecutionService);

        verifyNoInteractions(scriptNatsPublisher);
    }

    private BatchRunScriptInput batchInput(List<String> machineIds) {
        BatchRunScriptInput in = new BatchRunScriptInput();
        in.setMachineIds(machineIds);
        in.setScriptId(SCRIPT_ID);
        in.setPrivilegeLevel(PrivilegeLevel.ADMIN);
        return in;
    }

    @Test
    @DisplayName("batchRunScript: resolves the script once, mints ONE executionId, persists N History rows under it, and fans the same payload (shared executionId, per-machine machineId) out to every target")
    void batchRunScript_fansOutWithSharedExecutionId() {
        List<String> machines = List.of("machine-1", "machine-2", "machine-3");
        machines.forEach(id -> when(deviceService.findByMachineId(id)).thenReturn(Optional.of(new Machine())));

        DispatchResponse response = scriptDispatchService.batchRunScript(batchInput(machines), USER_ID, ExecutionSource.MANUAL);

        assertThat(response.getExecutionId()).isNotBlank();

        // Persist FIRST, publish SECOND — watchdog story depends on this ordering.
        org.mockito.InOrder inOrder = inOrder(scriptExecutionService, scriptNatsPublisher);
        inOrder.verify(scriptExecutionService).createBatch(
                eq(response.getExecutionId()),
                eq(SCRIPT_ID),
                eq((String) null), // ad-hoc batch — no schedule origin
                eq(machines),
                eq(PrivilegeLevel.ADMIN),
                eq(60),
                eq(USER_ID),
                eq(ExecutionSource.MANUAL));

        ArgumentCaptor<ScriptMessage> captor = ArgumentCaptor.forClass(ScriptMessage.class);
        for (String id : machines) {
            inOrder.verify(scriptNatsPublisher).publishScript(eq(id), captor.capture());
        }
        assertThat(captor.getAllValues())
                .allSatisfy(m -> {
                    assertThat(m.getExecutionId()).isEqualTo(response.getExecutionId());
                    assertThat(m.getCode()).isEqualTo("df -h");
                    assertThat(m.getShell()).isEqualTo(BASH);
                })
                .extracting(ScriptMessage::getMachineId)
                .containsExactlyInAnyOrderElementsOf(machines);

        // The saved script is resolved once for the whole batch, not per machine.
        verify(scriptService).get(SCRIPT_ID);
    }

    @Test
    @DisplayName("batchRunScript: an unknown machine rejects the whole batch — nothing is persisted, nothing is published")
    void batchRunScript_rejectsUnknownMachine() {
        when(deviceService.findByMachineId("machine-1")).thenReturn(Optional.of(new Machine()));
        when(deviceService.findByMachineId("machine-missing")).thenReturn(Optional.empty());

        assertThatThrownBy(() ->
                scriptDispatchService.batchRunScript(batchInput(List.of("machine-1", "machine-missing")), USER_ID, ExecutionSource.MANUAL))
                .isInstanceOf(DeviceNotFoundException.class);

        verifyNoInteractions(scriptExecutionService);
        verifyNoInteractions(scriptNatsPublisher);
    }

    @Test
    @DisplayName("batchRunScript: duplicate machineIds collapse to one publish per machine — and one Execution row per machine")
    void batchRunScript_dedupsMachineIds() {
        when(deviceService.findByMachineId("machine-1")).thenReturn(Optional.of(new Machine()));

        scriptDispatchService.batchRunScript(batchInput(List.of("machine-1", "machine-1")), USER_ID, ExecutionSource.MANUAL);

        verify(scriptExecutionService).createBatch(
                any(), eq(SCRIPT_ID), eq((String) null), eq(List.of("machine-1")), eq(PrivilegeLevel.ADMIN), eq(60), eq(USER_ID), eq(ExecutionSource.MANUAL));
        verify(scriptNatsPublisher, times(1)).publishScript(eq("machine-1"), any(ScriptMessage.class));
    }

    private ScriptMessage capturePublished() {
        ArgumentCaptor<ScriptMessage> captor = ArgumentCaptor.forClass(ScriptMessage.class);
        verify(scriptNatsPublisher).publishScript(eq(MACHINE_ID), captor.capture());
        return captor.getValue();
    }

    @Test
    @DisplayName("runSchedule: a script's stored custom params override its args + env for the manual run (full replace, not merge)")
    void runSchedule_customParamsOverrideArgsAndEnv() {
        String scheduleId = "sched-1";
        com.openframe.api.dto.rmm.schedule.ScriptScheduleResponse schedule =
                com.openframe.api.dto.rmm.schedule.ScriptScheduleResponse.builder()
                        .id(scheduleId)
                        .scriptIds(List.of(SCRIPT_ID))
                        .scriptCustomParams(List.of(
                                ScheduledScriptCustomParams.builder()
                                        .scriptId(SCRIPT_ID)
                                        .args(List.of("--custom", "42"))
                                        .envVars(List.of(new ScriptEnvVar("OVERRIDE", "v", false)))
                                        .build()))
                        .build();
        when(scriptScheduleService.get(scheduleId)).thenReturn(schedule);
        when(scriptScheduleDeviceService.getMachineIds(scheduleId)).thenReturn(List.of(MACHINE_ID));
        when(scriptService.getScriptsByIds(List.of(SCRIPT_ID))).thenReturn(List.of(
                ScriptResponse.builder()
                        .id(SCRIPT_ID).name("disk").shell(BASH).scriptBody("df -h")
                        .status(ACTIVE)
                        .defaultArgs(List.of("-a")).defaultTimeoutSeconds(60)
                        .envVars(List.of(ScriptEnvVarInput.builder().name("BASE").value("b").secret(false).build()))
                        .privilegeLevel(PrivilegeLevel.USER)
                        .build()));
        when(tenantIdProvider.getTenantId()).thenReturn("tenant-1");

        scriptDispatchService.runSchedule(scheduleId, USER_ID);

        ArgumentCaptor<ScriptScheduleExecutionMessage> msgCaptor =
                ArgumentCaptor.forClass(ScriptScheduleExecutionMessage.class);
        verify(scriptScheduleNatsPublisher).publish(eq(MACHINE_ID), msgCaptor.capture());
        ScriptScheduleExecutionItem item = msgCaptor.getValue().getScripts().get(0);
        assertThat(item.getArgs()).containsExactly("--custom", "42");
        assertThat(item.getEnvVars()).extracting(ScriptEnvVar::getName).containsExactly("OVERRIDE");
        assertThat(item.getEnvVars()).extracting(ScriptEnvVar::getName).doesNotContain("BASE");
    }
}
