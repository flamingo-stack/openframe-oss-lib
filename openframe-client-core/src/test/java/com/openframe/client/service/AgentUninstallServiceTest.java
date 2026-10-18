package com.openframe.client.service;

import com.openframe.client.event.DeviceUninstalledEvent;
import com.openframe.client.service.validator.ClientSecretValidator;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.oauth.OAuthClient;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.oauth.OAuthClientRepository;
import com.openframe.data.repository.rmm.DeviceOnlineDispatchRepository;
import com.openframe.data.repository.rmm.ScriptScheduleMachineAssignedRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
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
    @Mock private ScriptScheduleMachineAssignedRepository scheduleAssignedRepository;
    @Mock private DeviceOnlineDispatchRepository deviceOnlineDispatchRepository;
    @Mock private ApplicationEventPublisher eventPublisher;

    @InjectMocks private AgentUninstallService service;

    private Machine machineIs(DeviceStatus status) {
        Machine m = new Machine();
        m.setMachineId(MACHINE);
        m.setTenantId(TENANT);
        m.setStatus(status);
        when(oauthClientRepository.findByMachineId(MACHINE)).thenReturn(Optional.of(new OAuthClient()));
        when(machineRepository.findByMachineId(MACHINE)).thenReturn(Optional.of(m));
        return m;
    }

    @Test
    @DisplayName("uninstall marks the machine DELETED, cleans up schedules and publishes DeviceUninstalledEvent")
    void uninstallDeletesAndPublishes() {
        Machine machine = machineIs(DeviceStatus.PENDING_DELETION);

        service.uninstall(MACHINE, SECRET);

        assertThat(machine.getStatus()).isEqualTo(DeviceStatus.DELETED);
        verify(machineRepository).save(machine);
        verify(scheduleAssignedRepository).deleteByTenantIdAndMachineId(TENANT, MACHINE);
        verify(deviceOnlineDispatchRepository).deleteByTenantIdAndMachineId(TENANT, MACHINE);
        ArgumentCaptor<DeviceUninstalledEvent> event = ArgumentCaptor.forClass(DeviceUninstalledEvent.class);
        verify(eventPublisher).publishEvent(event.capture());
        assertThat(event.getValue().getMachine().getMachineId()).isEqualTo(MACHINE);
    }

    @Test
    @DisplayName("an already DELETED machine is a no-op and publishes nothing")
    void alreadyDeletedIsNoOp() {
        machineIs(DeviceStatus.DELETED);

        service.uninstall(MACHINE, SECRET);

        verify(machineRepository, never()).save(any());
        verifyNoInteractions(scheduleAssignedRepository, deviceOnlineDispatchRepository, eventPublisher);
    }

    @Test
    @DisplayName("a machine without a document publishes nothing")
    void missingMachinePublishesNothing() {
        when(oauthClientRepository.findByMachineId(MACHINE)).thenReturn(Optional.of(new OAuthClient()));
        when(machineRepository.findByMachineId(MACHINE)).thenReturn(Optional.empty());

        service.uninstall(MACHINE, SECRET);

        verifyNoInteractions(eventPublisher);
    }
}
