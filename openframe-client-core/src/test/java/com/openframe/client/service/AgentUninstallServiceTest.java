package com.openframe.client.service;

import com.openframe.client.service.rmm.delivery.DeliveryTracker;
import com.openframe.client.service.validator.ClientSecretValidator;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.oauth.OAuthClient;
import com.openframe.data.document.rmm.delivery.DeliveryKind;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.oauth.OAuthClientRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AgentUninstallServiceTest {

    private static final String MACHINE_ID = "mach-42";
    private static final String SECRET = "s3cret";

    @Mock private OAuthClientRepository oauthClientRepository;
    @Mock private ClientSecretValidator clientSecretValidator;
    @Mock private MachineRepository machineRepository;
    @Mock private ToolConnectionService toolConnectionService;
    @Mock private InstalledAgentService installedAgentService;
    @Mock private DeliveryTracker deliveryTracker;

    @InjectMocks private AgentUninstallService service;

    private OAuthClient client;
    private Machine machine;

    @BeforeEach
    void setUp() {
        client = new OAuthClient();
        machine = new Machine();
        machine.setMachineId(MACHINE_ID);
        machine.setStatus(DeviceStatus.PENDING_DELETION);
    }

    @Test
    void uninstall_pendingDeletionMachine_deletedAndDeliveryCompleted() {
        // setup
        when(oauthClientRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(client));
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));

        // execution
        service.uninstall(MACHINE_ID, SECRET);

        // verifications
        verify(clientSecretValidator).validate(client, SECRET);
        assertThat(machine.getStatus()).isEqualTo(DeviceStatus.DELETED);
        verify(machineRepository).save(machine);
        verify(toolConnectionService).disconnectAll(MACHINE_ID);
        verify(installedAgentService).disconnectAll(MACHINE_ID);
        verify(deliveryTracker).complete(DeliveryKind.CLIENT_UNINSTALL, MACHINE_ID, MACHINE_ID);
    }

    @Test
    void uninstall_alreadyDeleted_deliveryUntouched() {
        // setup
        machine.setStatus(DeviceStatus.DELETED);
        when(oauthClientRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(client));
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));

        // execution
        service.uninstall(MACHINE_ID, SECRET);

        // verifications
        verify(machineRepository, never()).save(machine);
        verifyNoInteractions(deliveryTracker);
    }

    @Test
    void uninstall_unknownClient_noop() {
        // setup
        when(oauthClientRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.empty());

        // execution
        service.uninstall(MACHINE_ID, SECRET);

        // verifications
        verifyNoInteractions(clientSecretValidator);
        verifyNoInteractions(machineRepository);
        verifyNoInteractions(deliveryTracker);
    }
}
