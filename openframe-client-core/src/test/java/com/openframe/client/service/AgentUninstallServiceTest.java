package com.openframe.client.service;

import com.openframe.client.service.validator.ClientSecretValidator;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.oauth.OAuthClient;
import com.openframe.data.nats.delivery.ClientUninstallDeliverySeed;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.oauth.OAuthClientRepository;
import com.openframe.delivery.track.DeliveryTracker;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AgentUninstallServiceTest {

    private static final String MACHINE_ID = "mach-42";
    private static final String CLIENT_SECRET = "secret";

    @Mock private OAuthClientRepository oauthClientRepository;
    @Mock private ClientSecretValidator clientSecretValidator;
    @Mock private MachineRepository machineRepository;
    @Mock private ToolConnectionService toolConnectionService;
    @Mock private InstalledAgentService installedAgentService;
    @Mock private DeliveryTracker deliveryTracker;

    @Captor private ArgumentCaptor<ClientUninstallDeliverySeed> seedCaptor;

    @InjectMocks private AgentUninstallService service;

    private Machine machine;

    @BeforeEach
    void setUp() {
        machine = new Machine();
        machine.setMachineId(MACHINE_ID);
        machine.setStatus(DeviceStatus.PENDING_DELETION);
        when(oauthClientRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(new OAuthClient()));
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
    }

    @Test
    void uninstall_machineInService_deletedAndDeliveryRowClosed() {
        // execution
        service.uninstall(MACHINE_ID, CLIENT_SECRET);

        // verifications
        assertThat(machine.getStatus()).isEqualTo(DeviceStatus.DELETED);
        verify(machineRepository).save(machine);
        verify(deliveryTracker).done(seedCaptor.capture());
        assertThat(seedCaptor.getValue().getMachineId()).isEqualTo(MACHINE_ID);
    }

    @Test
    void uninstall_machineAlreadyDeleted_nothingTouched() {
        // setup
        machine.setStatus(DeviceStatus.DELETED);

        // execution
        service.uninstall(MACHINE_ID, CLIENT_SECRET);

        // verifications
        verifyNoInteractions(deliveryTracker, toolConnectionService, installedAgentService);
    }
}
