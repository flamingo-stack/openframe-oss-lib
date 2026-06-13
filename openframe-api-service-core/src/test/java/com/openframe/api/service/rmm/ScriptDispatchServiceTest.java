package com.openframe.api.service.rmm;

import com.openframe.api.dto.script.RunScriptInput;
import com.openframe.api.dto.script.ScriptDispatchResponse;
import com.openframe.api.dto.script.ScriptEnvVarInput;
import com.openframe.api.dto.script.ScriptResponse;
import com.openframe.data.document.rmm.PrivilegeLevel;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ScriptDispatchServiceTest {

    private static final String MACHINE_ID = "machine-abc";
    private static final String SCRIPT_ID = "script-1";

    @Mock
    private ScriptService scriptService;
    @Mock
    private ScriptNatsPublisher scriptNatsPublisher;

    @InjectMocks
    private ScriptDispatchService scriptDispatchService;

    private RunScriptInput input;

    @BeforeEach
    void setUp() {
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
        when(scriptService.get(SCRIPT_ID)).thenReturn(script);

        input = new RunScriptInput();
        input.setMachineId(MACHINE_ID);
        input.setScriptId(SCRIPT_ID);
        input.setPrivilegeLevel(PrivilegeLevel.ADMIN);
    }

    @Test
    @DisplayName("runScript: resolves the saved script, builds an agent-shaped ScriptMessage (body/shell/envVars from the script, privilegeLevel from input), and returns the executionId")
    void runScript_resolvesScriptPublishesAndReturnsExecutionId() {
        ScriptDispatchResponse response = scriptDispatchService.runScript(input);

        assertThat(response.getExecutionId()).isNotBlank();

        ScriptMessage sent = capturePublished();
        assertThat(sent.getExecutionId()).isEqualTo(response.getExecutionId());
        assertThat(sent.getScriptBody()).isEqualTo("df -h");
        assertThat(sent.getShell()).isEqualTo(ScriptShell.BASH);
        assertThat(sent.getPrivilegeLevel()).isEqualTo(PrivilegeLevel.ADMIN);
        assertThat(sent.getEnvVars()).containsEntry("ENV", "prod");
    }

    @Test
    @DisplayName("runScript: with no overrides, args and timeout fall back to the script's stored defaults")
    void runScript_usesScriptDefaultsWhenNoOverride() {
        scriptDispatchService.runScript(input);

        ScriptMessage sent = capturePublished();
        assertThat(sent.getArgs()).containsExactly("-a");
        assertThat(sent.getTimeout()).isEqualTo(60);
    }

    @Test
    @DisplayName("runScript: input args and timeoutSeconds override the script's stored defaults")
    void runScript_overridesArgsAndTimeout() {
        input.setArgs(List.of("-x", "--verbose"));
        input.setTimeoutSeconds(90);

        scriptDispatchService.runScript(input);

        ScriptMessage sent = capturePublished();
        assertThat(sent.getArgs()).containsExactly("-x", "--verbose");
        assertThat(sent.getTimeout()).isEqualTo(90);
    }

    @Test
    @DisplayName("runScript: forwards the privilegeLevel (USER vs ADMIN) verbatim — from the input, not a backend default")
    void runScript_forwardsPrivilegeLevelVerbatim() {
        input.setPrivilegeLevel(PrivilegeLevel.USER);

        scriptDispatchService.runScript(input);

        assertThat(capturePublished().getPrivilegeLevel()).isEqualTo(PrivilegeLevel.USER);
    }

    @Test
    @DisplayName("runScript: each invocation generates a distinct executionId")
    void runScript_generatesDistinctExecutionIds() {
        String first = scriptDispatchService.runScript(input).getExecutionId();
        String second = scriptDispatchService.runScript(input).getExecutionId();
        String third = scriptDispatchService.runScript(input).getExecutionId();

        assertThat(List.of(first, second, third)).doesNotHaveDuplicates();
        verify(scriptNatsPublisher, times(3)).publishScript(eq(MACHINE_ID), any(ScriptMessage.class));
    }

    private ScriptMessage capturePublished() {
        ArgumentCaptor<ScriptMessage> captor = ArgumentCaptor.forClass(ScriptMessage.class);
        verify(scriptNatsPublisher).publishScript(eq(MACHINE_ID), captor.capture());
        return captor.getValue();
    }
}
