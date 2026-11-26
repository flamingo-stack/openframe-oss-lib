package com.openframe.client.service;

import com.openframe.audit.AuditContext;
import com.openframe.audit.AuditRecorder;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.client.event.DeviceUninstalledEvent;
import com.openframe.client.exception.InvalidClientSecretException;
import com.openframe.core.exception.ConflictException;
import com.openframe.client.service.validator.ClientSecretValidator;
import com.openframe.data.document.audit.AuditOutcome;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.oauth.OAuthClient;
import com.openframe.data.model.audit.AuditActor;
import com.openframe.data.model.audit.AuditEntry;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.oauth.OAuthClientRepository;
import com.openframe.data.service.rmm.DeletedMachineCleanup;
import com.openframe.data.service.rmm.DeletedMachineCleanup.LifecycleChange;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Answers;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.util.List;
import java.util.Optional;

import static com.openframe.core.exception.ErrorCode.CLIENT_SECRET_INVALID;
import static com.openframe.data.document.audit.AuditAction.DEVICE_UNINSTALL;
import static com.openframe.data.document.audit.AuditAction.SCRIPT_SCHEDULE_DEVICES_REMOVE;
import static com.openframe.data.document.audit.AuditActorType.DEVICE;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AgentUninstallServiceTest {

    private static final String MACHINE = "m-1";
    private static final String TENANT = "t-1";
    private static final String SECRET = "secret";
    private static final String AGENT_ROLE = "AGENT";

    @Mock private OAuthClientRepository oauthClientRepository;
    @Mock private ClientSecretValidator clientSecretValidator;
    @Mock private MachineRepository machineRepository;
    @Mock private ToolConnectionService toolConnectionService;
    @Mock private InstalledAgentService installedAgentService;
    @Mock private DeletedMachineCleanup deletedMachineCleanup;
    @Mock private ApplicationEventPublisher eventPublisher;
    @Mock(answer = Answers.CALLS_REAL_METHODS) private AuditedMethodRunner auditedMethodRunner;
    @Mock(answer = Answers.CALLS_REAL_METHODS) private AuditRecorder auditRecorder;

    @InjectMocks private AgentUninstallService service;

    private Machine machineIs(DeviceStatus status) {
        Machine m = new Machine();
        m.setMachineId(MACHINE);
        m.setTenantId(TENANT);
        m.setStatus(status);
        OAuthClient client = new OAuthClient();
        client.setRoles(new String[]{AGENT_ROLE});
        when(oauthClientRepository.findByMachineId(MACHINE)).thenReturn(Optional.of(client));
        when(machineRepository.findOnPrimaryByMachineId(MACHINE)).thenReturn(Optional.of(m));
        return m;
    }

    private void activeMachineIsDeleted(List<AuditEntry> scheduleRemovals) {
        Machine machine = machineIs(DeviceStatus.ONLINE);
        when(deletedMachineCleanup.markDeleted(machine)).thenReturn(new LifecycleChange(machine, scheduleRemovals));
    }

    @Test
    void uninstall_wrongSecret_throwsTheRefusalWithoutDeregisteringOrAnUninstallEvent() {
        OAuthClient client = new OAuthClient();
        when(oauthClientRepository.findByMachineId(MACHINE)).thenReturn(Optional.of(client));
        InvalidClientSecretException refused =
                new InvalidClientSecretException(CLIENT_SECRET_INVALID, "Invalid client secret");
        doThrow(refused).when(clientSecretValidator).validate(client, "wrong", "uninstall");

        assertThatThrownBy(() -> service.uninstall(MACHINE, "wrong")).isSameAs(refused);
        verifyNoInteractions(machineRepository, deletedMachineCleanup, auditedMethodRunner);
    }

    @Test
    void uninstall_activeMachine_runsAsTheDeviceWithItsLoginClientRoles() {
        activeMachineIsDeleted(List.of());

        service.uninstall(MACHINE, SECRET);

        ArgumentCaptor<AuditContext> context = ArgumentCaptor.forClass(AuditContext.class);
        verify(auditRecorder).runInContext(context.capture(), any(Runnable.class));
        assertThat(context.getValue().actor())
                .extracting(AuditActor::type, AuditActor::id, AuditActor::roles, AuditActor::tokenTenantId)
                .containsExactly(DEVICE, MACHINE, List.of(AGENT_ROLE), TENANT);
    }

    @Test
    void uninstall_deviceRemovedFromSchedules_recordsTheRemovalsInsideTheAuditedUninstall() {
        List<AuditEntry> removals = List.of(AuditEntry.builder()
                .action(SCRIPT_SCHEDULE_DEVICES_REMOVE)
                .outcome(AuditOutcome.SUCCESS)
                .targetId("schedule-1")
                .build());
        activeMachineIsDeleted(removals);
        doNothing().when(auditedMethodRunner).run(eq(DEVICE_UNINSTALL), eq(MACHINE), any(Runnable.class));
        service.uninstall(MACHINE, SECRET);
        ArgumentCaptor<Runnable> work = ArgumentCaptor.forClass(Runnable.class);
        verify(auditedMethodRunner).run(eq(DEVICE_UNINSTALL), eq(MACHINE), work.capture());

        work.getValue().run();

        verify(auditRecorder).recordAll(removals);
    }

    @Test
    @DisplayName("uninstall marks the machine DELETED, cleans up schedules and publishes DeviceUninstalledEvent")
    void uninstallDeletesAndPublishes() {
        Machine machine = machineIs(DeviceStatus.PENDING_DELETION);
        Machine deleted = new Machine();
        deleted.setMachineId(MACHINE);
        deleted.setTenantId(TENANT);
        deleted.setStatus(DeviceStatus.DELETED);
        when(deletedMachineCleanup.markDeleted(machine)).thenReturn(new LifecycleChange(deleted, List.of()));

        service.uninstall(MACHINE, SECRET);

        InOrder order = inOrder(deletedMachineCleanup, toolConnectionService, installedAgentService);
        order.verify(deletedMachineCleanup).markDeleted(machine);
        order.verify(toolConnectionService).disconnectAll(MACHINE);
        order.verify(installedAgentService).disconnectAll(MACHINE);
        verify(machineRepository, never()).save(any());
        ArgumentCaptor<DeviceUninstalledEvent> event = ArgumentCaptor.forClass(DeviceUninstalledEvent.class);
        verify(eventPublisher).publishEvent(event.capture());
        assertThat(event.getValue().getMachine()).isSameAs(deleted);
    }

    @Test
    @DisplayName("an already DELETED machine repeats schedule cleanup without republishing or an uninstall event")
    void alreadyDeletedRetriesScheduleCleanup() {
        Machine machine = machineIs(DeviceStatus.DELETED);
        when(deletedMachineCleanup.markDeleted(machine)).thenReturn(new LifecycleChange(machine, List.of()));

        service.uninstall(MACHINE, SECRET);

        verify(deletedMachineCleanup).markDeleted(machine);
        verifyNoInteractions(eventPublisher, auditedMethodRunner);
    }

    @Test
    @DisplayName("a machine without a document publishes nothing")
    void missingMachinePublishesNothing() {
        when(oauthClientRepository.findByMachineId(MACHINE)).thenReturn(Optional.of(new OAuthClient()));
        when(machineRepository.findOnPrimaryByMachineId(MACHINE)).thenReturn(Optional.empty());

        service.uninstall(MACHINE, SECRET);

        verifyNoInteractions(eventPublisher);
    }

    @Test
    @DisplayName("a machine document removed between the read and the write publishes nothing")
    void machineGoneBeforeTheWrite_publishesNothing() {
        Machine machine = machineIs(DeviceStatus.ONLINE);
        when(deletedMachineCleanup.markDeleted(machine)).thenThrow(new ConflictException("device changed"));
        when(machineRepository.findOnPrimaryByMachineId(MACHINE)).thenReturn(Optional.of(machine), Optional.empty());

        service.uninstall(MACHINE, SECRET);

        verifyNoInteractions(toolConnectionService, installedAgentService, eventPublisher);
    }

    @Test
    void uninstall_machineChangedByAnotherWriterAndStillThere_throwsTheConflict() {
        Machine machine = machineIs(DeviceStatus.ONLINE);
        ConflictException conflict = new ConflictException("device changed");
        when(deletedMachineCleanup.markDeleted(machine)).thenThrow(conflict);

        assertThatThrownBy(() -> service.uninstall(MACHINE, SECRET)).isSameAs(conflict);
        verifyNoInteractions(toolConnectionService, installedAgentService, eventPublisher);
    }
}
