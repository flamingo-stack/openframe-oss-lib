package com.openframe.api.service;

import com.openframe.api.dto.force.request.ForceClientUninstallRequest;
import com.openframe.api.dto.force.response.ForceAgentStatus;
import com.openframe.api.dto.force.response.ForceClientUninstallResponse;
import com.openframe.api.dto.force.response.ForceClientUninstallResponseItem;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.delivery.DeliveryKind;
import com.openframe.data.nats.delivery.DeliveryDispatch;
import com.openframe.data.nats.delivery.DeliveryRequest;
import com.openframe.data.nats.model.ClientUninstallMessage;
import com.openframe.data.nats.publisher.ClientUninstallNatsPublisher;
import com.openframe.data.repository.device.MachineRepository;
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
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ForceClientUninstallServiceTest {

    private static final String MACHINE_ID = "mach-42";

    @Mock private ClientUninstallNatsPublisher clientUninstallNatsPublisher;
    @Mock private MachineRepository machineRepository;
    @Mock private DeliveryDispatch deliveryDispatch;

    @Captor private ArgumentCaptor<DeliveryRequest> requestCaptor;
    @Captor private ArgumentCaptor<Runnable> publishCaptor;

    @InjectMocks private ForceClientUninstallService service;

    private Machine machine;
    private ForceClientUninstallRequest request;
    private ClientUninstallMessage message;

    @BeforeEach
    void setUp() {
        machine = new Machine();
        machine.setMachineId(MACHINE_ID);
        machine.setStatus(DeviceStatus.ONLINE);
        request = new ForceClientUninstallRequest();
        request.setMachineIds(List.of(MACHINE_ID));
        message = new ClientUninstallMessage();
    }

    @Test
    void process_onlineMachine_dispatchedAndMarkedPendingDeletion() {
        // setup
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
        when(clientUninstallNatsPublisher.buildMessage()).thenReturn(message);

        // execution
        ForceClientUninstallResponse response = service.process(request);

        // verifications
        verify(deliveryDispatch).send(requestCaptor.capture(), publishCaptor.capture());
        assertThat(requestCaptor.getValue().getKind()).isEqualTo(DeliveryKind.CLIENT_UNINSTALL);
        assertThat(requestCaptor.getValue().getTargetId()).isEqualTo(MACHINE_ID);
        assertThat(requestCaptor.getValue().getPayload()).isSameAs(message);
        publishCaptor.getValue().run();
        verify(clientUninstallNatsPublisher).publish(MACHINE_ID, message);
        assertThat(machine.getStatus()).isEqualTo(DeviceStatus.PENDING_DELETION);
        assertThat(response.getItems())
                .extracting(ForceClientUninstallResponseItem::getStatus)
                .containsExactly(ForceAgentStatus.PROCESSED);
    }

    @Test
    void process_deletedMachine_failedWithoutDispatch() {
        // setup
        machine.setStatus(DeviceStatus.DELETED);
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));

        // execution
        ForceClientUninstallResponse response = service.process(request);

        // verifications
        verifyNoInteractions(deliveryDispatch);
        assertThat(response.getItems())
                .extracting(ForceClientUninstallResponseItem::getStatus)
                .containsExactly(ForceAgentStatus.FAILED);
    }
}
