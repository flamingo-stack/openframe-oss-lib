package com.openframe.api.service;

import com.openframe.api.dto.force.request.ForceClientUninstallRequest;
import com.openframe.api.dto.force.response.ForceAgentStatus;
import com.openframe.api.dto.force.response.ForceClientUninstallResponse;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.nats.delivery.ClientUninstallDeliverySeed;
import com.openframe.data.nats.publisher.ClientUninstallNatsPublisher;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.delivery.config.DeliveryProperties;
import com.openframe.delivery.dispatch.DeliveryDispatcher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ForceClientUninstallServiceTest {

    private static final String MACHINE_ID = "mach-42";

    @Mock private ClientUninstallNatsPublisher clientUninstallNatsPublisher;
    @Mock private MachineRepository machineRepository;
    @Mock private DeliveryProperties deliveryProperties;
    @Mock private DeliveryDispatcher deliveryDispatcher;

    @Captor private ArgumentCaptor<ClientUninstallDeliverySeed> seedCaptor;

    @InjectMocks private ForceClientUninstallService service;

    private Machine machine;
    private ForceClientUninstallRequest request;

    @BeforeEach
    void setUp() {
        machine = new Machine();
        machine.setMachineId(MACHINE_ID);
        machine.setStatus(DeviceStatus.ONLINE);
        request = new ForceClientUninstallRequest();
        request.setMachineIds(List.of(MACHINE_ID));
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
    }

    @Test
    void process_flagOff_publishedToJetStreamAndMarkedPendingDeletion() {
        // setup
        when(deliveryProperties.isEnabled(DeliveryType.CLIENT_UNINSTALL)).thenReturn(false);

        // execution
        ForceClientUninstallResponse response = service.process(request);

        // verifications
        verify(clientUninstallNatsPublisher).publish(MACHINE_ID);
        assertThat(machine.getStatus()).isEqualTo(DeviceStatus.PENDING_DELETION);
        verify(machineRepository).save(machine);
        verifyNoInteractions(deliveryDispatcher);
        assertThat(response.getItems().get(0).getStatus()).isEqualTo(ForceAgentStatus.PROCESSED);
    }

    @Test
    void process_flagOn_dispatchedThroughEngineStatusUntouched() {
        // setup
        when(deliveryProperties.isEnabled(DeliveryType.CLIENT_UNINSTALL)).thenReturn(true);

        // execution
        ForceClientUninstallResponse response = service.process(request);

        // verifications
        verify(deliveryDispatcher).dispatch(seedCaptor.capture());
        assertThat(seedCaptor.getValue().getMachineId()).isEqualTo(MACHINE_ID);
        assertThat(machine.getStatus()).isEqualTo(DeviceStatus.ONLINE);
        verify(machineRepository, never()).save(any());
        verifyNoInteractions(clientUninstallNatsPublisher);
        assertThat(response.getItems().get(0).getStatus()).isEqualTo(ForceAgentStatus.PROCESSED);
    }

    @Test
    void process_flagOnUninstallAlreadyAcknowledged_notDispatchedAgain() {
        // setup
        machine.setStatus(DeviceStatus.PENDING_DELETION);
        when(deliveryProperties.isEnabled(DeliveryType.CLIENT_UNINSTALL)).thenReturn(true);

        // execution
        ForceClientUninstallResponse response = service.process(request);

        // verifications
        verifyNoInteractions(deliveryDispatcher, clientUninstallNatsPublisher);
        assertThat(response.getItems().get(0).getStatus()).isEqualTo(ForceAgentStatus.PROCESSED);
    }
}
