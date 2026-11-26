package com.openframe.api.service.rmm.script;

import com.openframe.api.dto.rmm.DispatchResponse;
import com.openframe.api.dto.rmm.schedule.ScriptScheduleResponse;
import com.openframe.api.dto.rmm.script.BatchRunScriptInput;
import com.openframe.api.dto.rmm.script.RunScriptInput;
import com.openframe.api.dto.rmm.script.ScriptEnvVarInput;
import com.openframe.api.dto.rmm.script.ScriptResponse;
import com.openframe.api.exception.DeviceNotFoundException;
import com.openframe.api.mapper.ScriptSecretSealer;
import com.openframe.api.service.device.DeviceService;
import com.openframe.api.service.rmm.schedule.ScheduleScriptDeviceService;
import com.openframe.api.service.rmm.schedule.ScheduleScriptService;
import com.openframe.audit.AuditCall;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.audit.AuditedWork;
import com.openframe.core.exception.BadRequestException;
import com.openframe.data.document.rmm.script.ScriptShell;
import com.openframe.data.nats.delivery.route.DeliveryRouter;
import com.openframe.data.nats.rmm.publisher.ScriptNatsPublisher;
import com.openframe.data.repository.rmm.ScheduleScriptExecutionRepository;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;

import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

import static com.openframe.data.document.rmm.script.ExecutionSource.AI_ASSISTANT;
import static com.openframe.data.document.rmm.script.ExecutionSource.MANUAL;
import static com.openframe.data.document.rmm.script.PrivilegeLevel.ADMIN;
import static com.openframe.data.document.rmm.script.ScriptShell.BASH;
import static com.openframe.data.document.rmm.script.ScriptShell.POWERSHELL;
import static com.openframe.data.document.rmm.script.ScriptStatus.ACTIVE;
import static com.openframe.data.document.rmm.script.ScriptStatus.ARCHIVED;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ScriptDispatchServiceAuditTest {

    private static final String MACHINE_ID = "machine-1";
    private static final String OTHER_MACHINE_ID = "machine-2";
    private static final String SCRIPT_ID = "script-1";
    private static final String ARCHIVED_SCRIPT_ID = "script-2";
    private static final String SCHEDULE_ID = "schedule-1";
    private static final String USER_ID = "user-1";

    @Mock
    private ScriptService scriptService;
    @Mock
    private ScriptNatsPublisher scriptNatsPublisher;
    @Mock
    private DeliveryRouter deliveryRouter;
    @Mock
    private DeviceService deviceService;
    @Mock
    private ScriptExecutionService scriptExecutionService;
    @Mock
    private ScheduleScriptService scheduleScriptService;
    @Mock
    private ScheduleScriptDeviceService scheduleScriptDeviceService;
    @Mock
    private ScheduleScriptExecutionRepository scheduleScriptExecutionRepository;
    @Mock
    private TenantIdProvider tenantIdProvider;
    @Mock
    private ScriptTimeoutValidator timeoutValidator;
    @Mock
    private ObjectProvider<ScriptSecretSealer> secretSealer;
    @Mock
    private AuditedMethodRunner auditedMethodRunner;

    @InjectMocks
    private ScriptDispatchService scriptDispatchService;

    private Object dispatched;

    @Test
    void runScript_varsSentBackUntouched_storesNoVarNames() {
        runsTheWork();
        savedScript(List.of("-a"));

        scriptDispatchService.runScript(runInput(List.of(envVar("REGION", "eu", false), envVar("TOKEN", null, true)),
                null), USER_ID, MANUAL);

        assertThat(storedDetails()).containsEntry("envVarNames", List.of());
    }

    @Test
    void runScript_oneVarChanged_storesOnlyThatVarName() {
        runsTheWork();
        savedScript(List.of("-a"));

        scriptDispatchService.runScript(runInput(List.of(envVar("REGION", "us", false), envVar("TOKEN", null, true)),
                null), USER_ID, MANUAL);

        assertThat(storedDetails()).containsEntry("envVarNames", List.of("REGION"));
    }

    @Test
    void runScript_storedVarNamedTwice_comparedWithTheLastOne() {
        runsTheWork();
        when(scriptService.get(SCRIPT_ID)).thenReturn(ScriptResponse.builder()
                .id(SCRIPT_ID)
                .shell(BASH)
                .scriptBody("echo $REGION")
                .envVars(List.of(envVar("REGION", "eu", false), envVar("REGION", "us", false)))
                .build());

        scriptDispatchService.runScript(runInput(List.of(envVar("REGION", "us", false)), null), USER_ID, MANUAL);

        assertThat(storedDetails()).containsEntry("envVarNames", List.of());
    }

    @Test
    void runScript_argsSameAsDefaults_storesArgsNotOverridden() {
        runsTheWork();
        savedScript(List.of("-a"));

        scriptDispatchService.runScript(runInput(null, List.of("-a")), USER_ID, MANUAL);

        assertThat(storedDetails()).containsEntry("argsOverridden", null);
    }

    @Test
    void runScript_otherArgs_storesArgsOverridden() {
        runsTheWork();
        savedScript(List.of("-a"));

        scriptDispatchService.runScript(runInput(null, List.of("-b")), USER_ID, MANUAL);

        assertThat(storedDetails()).containsEntry("argsOverridden", true);
    }

    @ParameterizedTest
    @MethodSource("varsDifferingFromStored")
    void runScript_varDiffersFromStored_storesItsName(ScriptEnvVarInput asked, String expectedName) {
        runsTheWork();
        savedScript(List.of("-a"));

        scriptDispatchService.runScript(runInput(List.of(asked), null), USER_ID, MANUAL);

        assertThat(storedDetails()).containsEntry("envVarNames", List.of(expectedName));
    }

    static Stream<Arguments> varsDifferingFromStored() {
        return Stream.of(
                Arguments.of(envVar("REGION", "eu", true), "REGION"),
                Arguments.of(envVar("CITY", "Paris", false), "CITY"));
    }

    @Test
    void runScript_noArgs_storesArgsNotOverridden() {
        runsTheWork();
        savedScript(List.of("-a"));

        scriptDispatchService.runScript(runInput(null, null), USER_ID, MANUAL);

        assertThat(storedDetails()).containsEntry("argsOverridden", null);
    }

    @Test
    void runScript_emptyArgsAndNoDefaultArgs_storesArgsNotOverridden() {
        runsTheWork();
        savedScript(null);

        scriptDispatchService.runScript(runInput(null, List.of()), USER_ID, MANUAL);

        assertThat(storedDetails()).containsEntry("argsOverridden", null);
    }

    @Test
    void runScript_argsSplitDifferentlyFromDefaults_storesArgsNotOverridden() {
        runsTheWork();
        savedScript(List.of("-Name", "value"));

        scriptDispatchService.runScript(runInput(null, List.of("-Name value")), USER_ID, MANUAL);

        assertThat(storedDetails()).containsEntry("argsOverridden", null);
    }

    @Test
    void runScript_refused_keepsTheAskedRun() {
        runsTheWork();
        refusedDevice();
        RunScriptInput input = runInput(List.of(envVar("REGION", "eu", false), envVar("TOKEN", null, true)), null);

        assertThatThrownBy(() -> scriptDispatchService.runScript(input, USER_ID, MANUAL))
                .isInstanceOf(DeviceNotFoundException.class)
                .hasMessage("Machine not found: machine-1");

        assertThat(storedDetails()).isEqualTo(Map.of("machineIds", List.of(MACHINE_ID), "privilegeLevel", ADMIN,
                "source", MANUAL, "envVarNames", List.of("REGION")));
    }

    @Test
    void runScript_refused_storesTheAskedDevice() {
        runsTheWork();
        refusedDevice();
        RunScriptInput input = runInput(null, null);

        assertThatThrownBy(() -> scriptDispatchService.runScript(input, USER_ID, MANUAL))
                .isInstanceOf(DeviceNotFoundException.class)
                .hasMessage("Machine not found: machine-1");

        assertThat(storedDeviceId()).isEqualTo(MACHINE_ID);
    }

    @Test
    void batchRunScript_draftRefused_keepsTheDraftAndItsShell() {
        runsTheWork();
        doThrow(new DeviceNotFoundException("Machine not found: machine-2"))
                .when(deviceService).verifyDispatchable(List.of(MACHINE_ID, OTHER_MACHINE_ID));
        BatchRunScriptInput draft = draftRun(List.of(MACHINE_ID, OTHER_MACHINE_ID), "Write-Output $env:REGION",
                POWERSHELL);

        assertThatThrownBy(() -> scriptDispatchService.batchRunScript(draft, USER_ID, AI_ASSISTANT))
                .isInstanceOf(DeviceNotFoundException.class)
                .hasMessage("Machine not found: machine-2");

        assertThat(storedDetails())
                .containsEntry("unsavedDraft", true)
                .containsEntry("shell", POWERSHELL);
    }

    @Test
    void batchRunScript_draftWithoutShell_storesTheScriptsShell() {
        runsTheWork();
        savedScript(List.of("-a"));

        scriptDispatchService.batchRunScript(draftRun(List.of(MACHINE_ID), "du -sh /tmp", null), USER_ID,
                AI_ASSISTANT);

        assertThat(storedDetails())
                .containsEntry("unsavedDraft", true)
                .containsEntry("shell", BASH);
    }

    @Test
    void batchRunScript_blankDraftBody_storesNoDraft() {
        runsTheWork();
        savedScript(List.of("-a"));

        scriptDispatchService.batchRunScript(draftRun(List.of(MACHINE_ID), "  ", POWERSHELL), USER_ID,
                AI_ASSISTANT);

        assertThat(storedDetails()).doesNotContainKeys("unsavedDraft", "shell");
    }

    @Test
    void runSchedule_archivedScript_storesOnlyTheScriptsSent() {
        runsTheWork();
        scheduleOn(List.of(MACHINE_ID, OTHER_MACHINE_ID));

        DispatchResponse response = scriptDispatchService.runSchedule(SCHEDULE_ID, USER_ID);

        assertThat(storedDetails()).isEqualTo(Map.of("executionIds", List.of(response.getExecutionId()),
                "machineIds", List.of(MACHINE_ID, OTHER_MACHINE_ID), "scriptIds", List.of(SCRIPT_ID)));
    }

    @Test
    void runSchedule_oneDevice_storesTheDevice() {
        runsTheWork();
        scheduleOn(List.of(MACHINE_ID));

        scriptDispatchService.runSchedule(SCHEDULE_ID, USER_ID);

        assertThat(storedDeviceId()).isEqualTo(MACHINE_ID);
    }

    @Test
    void runSchedule_twoDevices_storesNoDevice() {
        runsTheWork();
        scheduleOn(List.of(MACHINE_ID, OTHER_MACHINE_ID));

        scriptDispatchService.runSchedule(SCHEDULE_ID, USER_ID);

        assertThat(storedDeviceId()).isNull();
    }

    @Test
    void runSchedule_refused_storesNoDetailsOrDevice() {
        runsTheWork();
        when(scheduleScriptService.get(SCHEDULE_ID)).thenReturn(ScriptScheduleResponse.builder()
                .id(SCHEDULE_ID)
                .scriptIds(List.of(SCRIPT_ID))
                .build());
        when(scheduleScriptDeviceService.getMachineIds(SCHEDULE_ID)).thenReturn(List.of());

        assertThatThrownBy(() -> scriptDispatchService.runSchedule(SCHEDULE_ID, USER_ID))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Schedule has no assigned devices: schedule-1");

        assertThat(storedDetails()).isEmpty();
        assertThat(storedDeviceId()).isNull();
    }

    private void runsTheWork() {
        when(auditedMethodRunner.run(any(AuditCall.class), any())).thenAnswer(invocation -> {
            dispatched = invocation.<AuditedWork<?, ?>>getArgument(1).run();
            return dispatched;
        });
    }

    private void savedScript(List<String> defaultArgs) {
        when(scriptService.get(SCRIPT_ID)).thenReturn(ScriptResponse.builder()
                .id(SCRIPT_ID)
                .shell(BASH)
                .scriptBody("echo $REGION")
                .defaultArgs(defaultArgs)
                .envVars(List.of(envVar("REGION", "eu", false), envVar("TOKEN", "s3cr3t", true)))
                .build());
    }

    private void refusedDevice() {
        doThrow(new DeviceNotFoundException("Machine not found: machine-1"))
                .when(deviceService).verifyDispatchable(MACHINE_ID);
    }

    private void scheduleOn(List<String> machineIds) {
        when(scheduleScriptService.get(SCHEDULE_ID)).thenReturn(ScriptScheduleResponse.builder()
                .id(SCHEDULE_ID)
                .scriptIds(List.of(SCRIPT_ID, ARCHIVED_SCRIPT_ID))
                .build());
        when(scheduleScriptDeviceService.getMachineIds(SCHEDULE_ID)).thenReturn(machineIds);
        when(scriptService.getScriptsByIds(List.of(SCRIPT_ID, ARCHIVED_SCRIPT_ID))).thenReturn(List.of(
                ScriptResponse.builder().id(SCRIPT_ID).status(ACTIVE).build(),
                ScriptResponse.builder().id(ARCHIVED_SCRIPT_ID).status(ARCHIVED).build()));
    }

    private Map<String, Object> storedDetails() {
        return auditCall().detailsFromResult().apply(dispatched);
    }

    private String storedDeviceId() {
        return auditCall().deviceIdOf().apply(dispatched);
    }

    private AuditCall auditCall() {
        ArgumentCaptor<AuditCall> call = ArgumentCaptor.forClass(AuditCall.class);
        verify(auditedMethodRunner).run(call.capture(), any());
        return call.getValue();
    }

    private static RunScriptInput runInput(List<ScriptEnvVarInput> envVars, List<String> args) {
        RunScriptInput input = new RunScriptInput();
        input.setMachineId(MACHINE_ID);
        input.setScriptId(SCRIPT_ID);
        input.setPrivilegeLevel(ADMIN);
        input.setEnvVars(envVars);
        input.setArgs(args);
        return input;
    }

    private static BatchRunScriptInput draftRun(List<String> machineIds, String scriptBody, ScriptShell shell) {
        BatchRunScriptInput input = new BatchRunScriptInput();
        input.setMachineIds(machineIds);
        input.setScriptId(SCRIPT_ID);
        input.setPrivilegeLevel(ADMIN);
        input.setScriptBody(scriptBody);
        input.setShell(shell);
        return input;
    }

    private static ScriptEnvVarInput envVar(String name, String value, boolean secret) {
        return ScriptEnvVarInput.builder().name(name).value(value).secret(secret).build();
    }
}
