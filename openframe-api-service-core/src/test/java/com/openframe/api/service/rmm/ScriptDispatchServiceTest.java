package com.openframe.api.service.rmm;

import com.openframe.api.dto.rmm.DispatchResponse;
import com.openframe.api.dto.script.RunScriptInput;
import com.openframe.api.dto.script.ScriptEnvVarInput;
import com.openframe.api.dto.script.ScriptResponse;
import com.openframe.api.exception.DeviceNotFoundException;
import com.openframe.api.service.DeviceService;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.PrivilegeLevel;
import com.openframe.data.document.rmm.ScriptEnvVar;
import com.openframe.data.document.rmm.ScriptShell;
import com.openframe.data.nats.rmm.model.ScriptMessage;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ScriptDispatchServiceTest {

    private static final String MACHINE_ID = "machine-abc";
    private static final String SCRIPT_ID = "script-1";

    @Mock
    private ScriptService scriptService;
    @Mock
    private ScriptNatsPublisher scriptNatsPublisher;
    @Mock
    private DeviceService deviceService;

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
                .shell("BASH")
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
    @DisplayName("runScript: resolves the saved script and builds an agent-shaped ScriptMessage — the SAME executionId is returned to the FE and carried in the wire payload (so the agent's result correlates back), plus machineId/code/shell/privilegeLevel/envVars verbatim")
    void runScript_resolvesScriptPublishesAndReturnsExecutionId() {
        DispatchResponse response = scriptDispatchService.runScript(input);

        assertThat(response.getExecutionId()).isNotBlank();

        ScriptMessage sent = capturePublished();
        // The wire payload MUST carry the same executionId returned to the FE — that is
        // what lets the agent's ScriptResultMessage correlate to this dispatch.
        assertThat(sent.getExecutionId()).isEqualTo(response.getExecutionId());
        assertThat(sent.getMachineId()).isEqualTo(MACHINE_ID);
        assertThat(sent.getCode()).isEqualTo("df -h");
        assertThat(sent.getShell()).isEqualTo(ScriptShell.BASH);
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
        scriptDispatchService.runScript(input);

        ScriptMessage sent = capturePublished();
        assertThat(sent.getArgs()).containsExactly("-a");
        assertThat(sent.getTimeoutSeconds()).isEqualTo(60);
    }

    @Test
    @DisplayName("runScript: input args and timeoutSeconds override the script's stored defaults")
    void runScript_overridesArgsAndTimeout() {
        input.setArgs(List.of("-x", "--verbose"));
        input.setTimeoutSeconds(90);

        scriptDispatchService.runScript(input);

        ScriptMessage sent = capturePublished();
        assertThat(sent.getArgs()).containsExactly("-x", "--verbose");
        assertThat(sent.getTimeoutSeconds()).isEqualTo(90);
    }

    @Test
    @DisplayName("runScript: input env vars are merged over the script's stored ones — a same-named var overrides, a new name is added; secret flag is preserved")
    void runScript_mergesAndOverridesEnvVars() {
        input.setEnvVars(List.of(
                ScriptEnvVarInput.builder().name("ENV").value("staging").secret(false).build(),   // overrides stored ENV=prod
                ScriptEnvVarInput.builder().name("TOKEN").value("xyz").secret(true).build()        // new var
        ));

        scriptDispatchService.runScript(input);

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

        scriptDispatchService.runScript(input);

        assertThat(capturePublished().getPrivilegeLevel()).isEqualTo(PrivilegeLevel.USER);
    }

    @Test
    @DisplayName("runScript: each invocation generates a distinct executionId (returned to FE in DispatchResponse; not present in the wire payload)")
    void runScript_generatesDistinctExecutionIds() {
        String first = scriptDispatchService.runScript(input).getExecutionId();
        String second = scriptDispatchService.runScript(input).getExecutionId();
        String third = scriptDispatchService.runScript(input).getExecutionId();

        assertThat(List.of(first, second, third)).doesNotHaveDuplicates();
        verify(scriptNatsPublisher, times(3)).publishScript(eq(MACHINE_ID), any(ScriptMessage.class));
    }

    @Test
    @DisplayName("runScript: a non-existent machine is rejected (DeviceNotFoundException) and nothing is published")
    void runScript_rejectsUnknownMachine() {
        when(deviceService.findByMachineId(MACHINE_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> scriptDispatchService.runScript(input))
                .isInstanceOf(DeviceNotFoundException.class);

        verifyNoInteractions(scriptNatsPublisher);
    }

    private ScriptMessage capturePublished() {
        ArgumentCaptor<ScriptMessage> captor = ArgumentCaptor.forClass(ScriptMessage.class);
        verify(scriptNatsPublisher).publishScript(eq(MACHINE_ID), captor.capture());
        return captor.getValue();
    }
}
