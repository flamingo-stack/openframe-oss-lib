package com.openframe.client.service;

import com.openframe.client.event.DeviceUninstalledEvent;
import com.openframe.core.exception.ConflictException;
import com.openframe.client.service.validator.ClientSecretValidator;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.oauth.OAuthClient;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.oauth.OAuthClientRepository;
import com.openframe.data.service.rmm.DeletedMachineCleanup;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AgentUninstallServiceTest {

    private static final String MACHINE = "m-1";
    private static final String TENANT = "t-1";
    private static final String SECRET = "secret";

    @Mock private OAuthClientRepository oauthClientRepository;
    @Mock private ClientSecretValidator clientSecretValidator;
    @Mock private MachineRepository machineRepository;
    @Mock private ToolConnectionService toolConnectionService;
    @Mock private InstalledAgentService installedAgentService;
    @Mock private DeletedMachineCleanup deletedMachineCleanup;
    @Mock private ApplicationEventPublisher eventPublisher;

    @InjectMocks private AgentUninstallService service;

    private Machine machineIs(DeviceStatus status) {
        Machine m = new Machine();
        m.setMachineId(MACHINE);
        m.setTenantId(TENANT);
        m.setStatus(status);
        when(oauthClientRepository.findByMachineId(MACHINE)).thenReturn(Optional.of(new OAuthClient()));
        when(machineRepository.findOnPrimaryByMachineId(MACHINE)).thenReturn(Optional.of(m));
        return m;
    }

    @Test
    @DisplayName("uninstall marks the machine DELETED, cleans up schedules and publishes DeviceUninstalledEvent")
    void uninstallDeletesAndPublishes() {
        Machine machine = machineIs(DeviceStatus.PENDING_DELETION);
        Machine deleted = new Machine();
        deleted.setMachineId(MACHINE);
        deleted.setTenantId(TENANT);
        deleted.setStatus(DeviceStatus.DELETED);
        when(deletedMachineCleanup.markDeleted(machine)).thenReturn(deleted);

        service.uninstall(MACHINE, SECRET);

        InOrder order = inOrder(deletedMachineCleanup, toolConnectionService, installedAgentService);
        order.verify(deletedMachineCleanup).markDeleted(machine);
        order.verify(toolConnectionService).disconnectAll(MACHINE);
        order.verify(installedAgentService).disconnectAll(MACHINE);
        verify(machineRepository, never()).save(any());
        ArgumentCaptor<DeviceUninstalledEvent> event = ArgumentCaptor.forClass(DeviceUninstalledEvent.class);
        verify(eventPublisher).publishEvent(event.capture());
        assertThat(event.getValue().getMachine().getMachineId()).isEqualTo(MACHINE);
    }

    @Test
    @DisplayName("an already DELETED machine repeats schedule cleanup without republishing")
    void alreadyDeletedRetriesScheduleCleanup() {
        Machine machine = machineIs(DeviceStatus.DELETED);
        when(deletedMachineCleanup.markDeleted(machine)).thenReturn(machine);

        service.uninstall(MACHINE, SECRET);

        verify(deletedMachineCleanup).markDeleted(machine);
        verifyNoInteractions(eventPublisher);
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
        Machine machine = machineIs(DeviceStatus.MANAGED);
        when(deletedMachineCleanup.markDeleted(machine)).thenThrow(new ConflictException("device changed"));
        when(machineRepository.findOnPrimaryByMachineId(MACHINE)).thenReturn(Optional.of(machine), Optional.empty());

        service.uninstall(MACHINE, SECRET);

        verifyNoInteractions(toolConnectionService, installedAgentService, eventPublisher);
    }
}
