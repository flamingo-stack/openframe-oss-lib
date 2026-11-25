package com.openframe.client.service.rmm;

import java.util.List;
import com.openframe.data.document.rmm.script.ScriptEnvVar;
import com.openframe.client.support.TestEncryption;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.bootstrap.SystemScriptCode;
import com.openframe.data.document.rmm.script.ExecutionSource;
import com.openframe.data.document.rmm.script.ExecutionStatus;
import com.openframe.data.document.rmm.script.PrivilegeLevel;
import com.openframe.data.document.rmm.script.Script;
import com.openframe.data.document.rmm.script.ScriptExecution;
import com.openframe.data.document.rmm.script.ScriptShell;
import com.openframe.data.document.rmm.script.ScriptType;
import com.openframe.data.nats.rmm.model.ScriptMessage;
import com.openframe.data.nats.rmm.publisher.ScriptBootstrapNatsPublisher;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import com.openframe.data.repository.rmm.ScriptRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PackageManagerBootstrapServiceTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String MACHINE_ID = "machine-1";
    private static final String SCRIPT_ID = "script-1";
    private static final long COOLDOWN_SECONDS = 1800;

    private MachineRepository machineRepository;
    private ScriptRepository scriptRepository;
    private ScriptExecutionRepository scriptExecutionRepository;
    private ScriptBootstrapNatsPublisher scriptBootstrapNatsPublisher;
    private PackageManagerBootstrapService service;

    @BeforeEach
    void setUp() {
        machineRepository = mock(MachineRepository.class);
        scriptRepository = mock(ScriptRepository.class);
        scriptExecutionRepository = mock(ScriptExecutionRepository.class);
        scriptBootstrapNatsPublisher = mock(ScriptBootstrapNatsPublisher.class);
        service = new PackageManagerBootstrapService(
                machineRepository, scriptRepository, scriptExecutionRepository,
                scriptBootstrapNatsPublisher, TestEncryption.SERVICE);
        ReflectionTestUtils.setField(service, "cooldownSeconds", COOLDOWN_SECONDS);
    }

    private void givenMachine(DeviceStatus status) {
        Machine machine = new Machine();
        machine.setMachineId(MACHINE_ID);
        machine.setTenantId(TENANT_ID);
        machine.setStatus(status);
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
    }

    private Script givenSeededScript() {
        return givenSeededScript(SystemScriptCode.INSTALL_WINGET, PrivilegeLevel.USER);
    }

    private Script givenSeededScript(SystemScriptCode code, PrivilegeLevel privilegeLevel) {
        Script script = Script.builder()
                .id(SCRIPT_ID)
                .tenantId(TENANT_ID)
                .name(code.canonicalName())
                .scriptBody(code.canonicalName() + " body")
                .shell(ScriptShell.POWERSHELL)
                .privilegeLevel(privilegeLevel)
                .defaultTimeoutSeconds(1800)
                .type(ScriptType.SYSTEM)
                .build();
        when(scriptRepository.findByTenantIdAndNameAndType(TENANT_ID, code.canonicalName(), ScriptType.SYSTEM))
                .thenReturn(Optional.of(script));
        return script;
    }

    private void givenLastExecution(ExecutionStatus status, Instant dispatchedAt) {
        ScriptExecution execution = ScriptExecution.builder()
                .executionId("prior-exec")
                .machineId(MACHINE_ID)
                .scriptId(SCRIPT_ID)
                .source(ExecutionSource.SYSTEM_BOOTSTRAP)
                .status(status)
                .dispatchedAt(dispatchedAt)
                .build();
        when(scriptExecutionRepository.findFirstByTenantIdAndMachineIdAndScriptIdAndSourceOrderByDispatchedAtDesc(
                TENANT_ID, MACHINE_ID, SCRIPT_ID, ExecutionSource.SYSTEM_BOOTSTRAP))
                .thenReturn(Optional.of(execution));
    }

    @Test
    @DisplayName("a stored secret env var reaches the agent in the clear")
    void storedSecret_sentInTheClear() {
        givenMachine(DeviceStatus.MANAGED);
        Script script = givenSeededScript();
        ScriptEnvVar secret = ScriptEnvVar.builder().name("TOKEN").value("s3cr3t").secret(true).build();
        ScriptEnvVar sealed = secret.sealed(TestEncryption.SERVICE::encrypt);
        script.setEnvVars(List.of(sealed));
        when(scriptExecutionRepository.findFirstByTenantIdAndMachineIdAndScriptIdAndSourceOrderByDispatchedAtDesc(
                any(), any(), any(), any())).thenReturn(Optional.empty());

        service.dispatchInstall(MACHINE_ID, PackageManagerType.WINGET);

        ArgumentCaptor<ScriptMessage> message = ArgumentCaptor.forClass(ScriptMessage.class);
        verify(scriptBootstrapNatsPublisher).publishBootstrapScript(anyString(), message.capture());
        ScriptEnvVar sent = message.getValue().getEnvVars().get(0);
        assertThat(sent.getValue()).isEqualTo("s3cr3t");
        assertThat(sent.isEncrypted()).isFalse();
    }

    @Test
    @DisplayName("first report: persists a RUNNING SYSTEM_BOOTSTRAP row and publishes the script with ITS privilege level")
    void dispatchesOnFirstReport() {
        givenMachine(DeviceStatus.MANAGED);
        givenSeededScript();
        when(scriptExecutionRepository.findFirstByTenantIdAndMachineIdAndScriptIdAndSourceOrderByDispatchedAtDesc(
                any(), any(), any(), any())).thenReturn(Optional.empty());

        service.dispatchInstall(MACHINE_ID, PackageManagerType.WINGET);

        ArgumentCaptor<ScriptExecution> row = ArgumentCaptor.forClass(ScriptExecution.class);
        verify(scriptExecutionRepository).save(row.capture());
        assertThat(row.getValue().getTenantId()).isEqualTo(TENANT_ID);
        assertThat(row.getValue().getSource()).isEqualTo(ExecutionSource.SYSTEM_BOOTSTRAP);
        assertThat(row.getValue().getStatus()).isEqualTo(ExecutionStatus.RUNNING);
        assertThat(row.getValue().getPrivilegeLevel()).isEqualTo(PrivilegeLevel.USER);
        assertThat(row.getValue().getTimeoutSeconds()).isEqualTo(1800);
        assertThat(row.getValue().getPackageManager()).isEqualTo(PackageManagerType.WINGET);

        ArgumentCaptor<ScriptMessage> message = ArgumentCaptor.forClass(ScriptMessage.class);
        verify(scriptBootstrapNatsPublisher).publishBootstrapScript(anyString(), message.capture());
        assertThat(message.getValue().getMachineId()).isEqualTo(MACHINE_ID);
        assertThat(message.getValue().getCode()).isEqualTo("__system__install-winget body");
        assertThat(message.getValue().getShell()).isEqualTo(ScriptShell.POWERSHELL);
        assertThat(message.getValue().getPrivilegeLevel()).isEqualTo(PrivilegeLevel.USER);
        assertThat(message.getValue().getExecutionId()).isEqualTo(row.getValue().getExecutionId());
    }

    @Test
    @DisplayName("a manager dependency: its own system script goes out under the manager's name")
    void dispatchesDependencyScriptUnderItsManager() {
        givenMachine(DeviceStatus.MANAGED);
        givenSeededScript(SystemScriptCode.INSTALL_WINGET_CLIENT_MODULE, PrivilegeLevel.ADMIN);
        when(scriptExecutionRepository.findFirstByTenantIdAndMachineIdAndScriptIdAndSourceOrderByDispatchedAtDesc(
                any(), any(), any(), any())).thenReturn(Optional.empty());

        service.dispatchInstall(MACHINE_ID, PackageManagerType.WINGET, SystemScriptCode.INSTALL_WINGET_CLIENT_MODULE);

        ArgumentCaptor<ScriptExecution> row = ArgumentCaptor.forClass(ScriptExecution.class);
        verify(scriptExecutionRepository).save(row.capture());
        assertThat(row.getValue().getScriptId()).isEqualTo(SCRIPT_ID);
        assertThat(row.getValue().getPackageManager()).isEqualTo(PackageManagerType.WINGET);
        assertThat(row.getValue().getPrivilegeLevel()).isEqualTo(PrivilegeLevel.ADMIN);

        ArgumentCaptor<ScriptMessage> message = ArgumentCaptor.forClass(ScriptMessage.class);
        verify(scriptBootstrapNatsPublisher).publishBootstrapScript(anyString(), message.capture());
        assertThat(message.getValue().getCode()).isEqualTo("__system__install-winget-client-module body");
        assertThat(message.getValue().getPrivilegeLevel()).isEqualTo(PrivilegeLevel.ADMIN);
    }

    @Test
    @DisplayName("an in-flight bootstrap run suppresses re-dispatch regardless of its age")
    void skipsWhenInFlight() {
        givenMachine(DeviceStatus.MANAGED);
        givenSeededScript();
        givenLastExecution(ExecutionStatus.RUNNING, Instant.now().minusSeconds(COOLDOWN_SECONDS * 10));

        service.dispatchInstall(MACHINE_ID, PackageManagerType.WINGET);

        verify(scriptBootstrapNatsPublisher, never()).publishBootstrapScript(anyString(), any());
        verify(scriptExecutionRepository, never()).save(any());
    }

    @Test
    @DisplayName("a finished run inside the cooldown window suppresses re-dispatch — the agent's next report retries")
    void skipsWithinCooldown() {
        givenMachine(DeviceStatus.MANAGED);
        givenSeededScript();
        givenLastExecution(ExecutionStatus.FAILED, Instant.now().minusSeconds(60));

        service.dispatchInstall(MACHINE_ID, PackageManagerType.WINGET);

        verify(scriptBootstrapNatsPublisher, never()).publishBootstrapScript(anyString(), any());
    }

    @Test
    @DisplayName("a failed run past the cooldown is retried")
    void redispatchesAfterCooldown() {
        givenMachine(DeviceStatus.MANAGED);
        givenSeededScript();
        givenLastExecution(ExecutionStatus.FAILED, Instant.now().minusSeconds(COOLDOWN_SECONDS + 60));

        service.dispatchInstall(MACHINE_ID, PackageManagerType.WINGET);

        verify(scriptBootstrapNatsPublisher).publishBootstrapScript(anyString(), any(ScriptMessage.class));
    }

    @Test
    @DisplayName("unknown machine: report is ignored")
    void ignoresUnknownMachine() {
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.empty());

        service.dispatchInstall(MACHINE_ID, PackageManagerType.BREW);

        verify(scriptBootstrapNatsPublisher, never()).publishBootstrapScript(anyString(), any());
    }

    @Test
    @DisplayName("machine pending deletion: report is ignored")
    void ignoresDeletedMachine() {
        givenMachine(DeviceStatus.PENDING_DELETION);

        service.dispatchInstall(MACHINE_ID, PackageManagerType.BREW);

        verify(scriptBootstrapNatsPublisher, never()).publishBootstrapScript(anyString(), any());
    }

    @Test
    @DisplayName("archived machine: not dispatch-eligible, report is ignored — same bar as runScript")
    void ignoresArchivedMachine() {
        givenMachine(DeviceStatus.ARCHIVED);

        service.dispatchInstall(MACHINE_ID, PackageManagerType.BREW);

        verify(scriptBootstrapNatsPublisher, never()).publishBootstrapScript(anyString(), any());
    }

    @Test
    @DisplayName("system script not seeded yet: report is ignored, the agent re-reports later")
    void ignoresWhenScriptNotSeeded() {
        givenMachine(DeviceStatus.MANAGED);
        when(scriptRepository.findByTenantIdAndNameAndType(
                TENANT_ID, SystemScriptCode.INSTALL_BREW.canonicalName(), ScriptType.SYSTEM))
                .thenReturn(Optional.empty());

        service.dispatchInstall(MACHINE_ID, PackageManagerType.BREW);

        verify(scriptBootstrapNatsPublisher, never()).publishBootstrapScript(anyString(), any());
        verify(scriptExecutionRepository, never()).save(any());
    }
}
