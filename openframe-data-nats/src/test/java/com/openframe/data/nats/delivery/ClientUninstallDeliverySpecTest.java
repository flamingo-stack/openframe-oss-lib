package com.openframe.data.nats.delivery;

import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.nats.model.ClientUninstallMessage;
import com.openframe.data.nats.publisher.ClientUninstallNatsPublisher;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.delivery.DeliveryRequest;
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
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ClientUninstallDeliverySpecTest {

    private static final String MACHINE_ID = "mach-42";

    @Mock private ClientUninstallNatsPublisher publisher;
    @Mock private MachineRepository machineRepository;

    @InjectMocks private ClientUninstallDeliverySpec spec;

    private MachineDelivery delivery;
    private Machine machine;
    private ClientUninstallMessage message;

    @BeforeEach
    void setUp() {
        delivery = MachineDelivery.builder()
                .type(DeliveryType.CLIENT_UNINSTALL)
                .targetId(MACHINE_ID)
                .machineId(MACHINE_ID)
                .build();
        machine = new Machine();
        machine.setMachineId(MACHINE_ID);
        message = new ClientUninstallMessage();
    }

    @Test
    void request_machine_targetIsMachineAndPayloadBuiltByPublisher() {
        // setup
        when(publisher.buildMessage()).thenReturn(message);

        // execution
        ClientUninstallDeliverySpec.Seed seed = new ClientUninstallDeliverySpec.Seed(MACHINE_ID);
        DeliveryRequest<ClientUninstallMessage> request = spec.request(seed);

        // verifications
        assertThat(request.getType()).isEqualTo(DeliveryType.CLIENT_UNINSTALL);
        assertThat(request.getTargetId()).isEqualTo(MACHINE_ID);
        assertThat(request.getMachineId()).isEqualTo(MACHINE_ID);
        assertThat(request.getPayload()).isSameAs(message);
    }

    @Test
    void onFailed_machinePendingDeletion_restoredToOffline() {
        // setup
        machine.setStatus(DeviceStatus.PENDING_DELETION);
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));

        // execution
        spec.onFailed(delivery, DeliveryFailure.EXHAUSTED);

        // verifications
        assertThat(machine.getStatus()).isEqualTo(DeviceStatus.OFFLINE);
        verify(machineRepository).save(machine);
    }

    @Test
    void onFailed_machineAlreadyDeleted_untouched() {
        // setup
        machine.setStatus(DeviceStatus.DELETED);
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));

        // execution
        spec.onFailed(delivery, DeliveryFailure.OFFLINE);

        // verifications
        assertThat(machine.getStatus()).isEqualTo(DeviceStatus.DELETED);
        verify(machineRepository, never()).save(machine);
    }
}
