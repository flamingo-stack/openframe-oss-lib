package com.openframe.data.nats.delivery;

import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.nats.model.ClientUninstallMessage;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.delivery.spec.DeliveryRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ClientUninstallDeliverySpecTest {

    private static final String MACHINE_ID = "mach-42";
    private static final String TARGET_ID = "openframe-client";

    @Mock private MachineRepository machineRepository;

    @InjectMocks private ClientUninstallDeliverySpec spec;

    private Machine machine;
    private MachineDelivery delivery;

    @BeforeEach
    void setUp() {
        machine = new Machine();
        machine.setMachineId(MACHINE_ID);
        machine.setStatus(DeviceStatus.ONLINE);
        delivery = MachineDelivery.builder()
                .type(DeliveryType.CLIENT_UNINSTALL)
                .targetId(TARGET_ID)
                .machineId(MACHINE_ID)
                .build();
    }

    @Test
    void request_seed_messageStampedAndTargetIsTheClient() {
        // setup
        ClientUninstallDeliverySeed seed = new ClientUninstallDeliverySeed(MACHINE_ID);

        // execution
        DeliveryRequest<ClientUninstallMessage> request = spec.request(seed);

        // verifications
        assertThat(request.getType()).isEqualTo(DeliveryType.CLIENT_UNINSTALL);
        assertThat(request.getTargetId()).isEqualTo(TARGET_ID);
        assertThat(request.getMachineId()).isEqualTo(MACHINE_ID);
        assertThat(request.getPayload().getIssuedAt()).isNotBlank();
        assertThat(request.getPayload().getDelivery()).isNull();
    }

    @Test
    void targetId_anySeed_theClientItself() {
        // execution
        String targetId = spec.targetId(new ClientUninstallDeliverySeed(MACHINE_ID));

        // verifications
        assertThat(targetId).isEqualTo(TARGET_ID);
    }

    @Test
    void subject_machineId_machineClientUninstallSubject() {
        // execution
        String subject = spec.subject(MACHINE_ID);

        // verifications
        assertThat(subject).isEqualTo("machine.mach-42.client-uninstall");
    }

    @Test
    void onAcked_machineInService_markedPendingDeletion() {
        // setup
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));

        // execution
        spec.onAcked(delivery);

        // verifications
        assertThat(machine.getStatus()).isEqualTo(DeviceStatus.PENDING_DELETION);
        verify(machineRepository).save(machine);
    }

    @Test
    void onAcked_machineAlreadyDeleted_untouched() {
        // setup
        machine.setStatus(DeviceStatus.DELETED);
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));

        // execution
        spec.onAcked(delivery);

        // verifications
        assertThat(machine.getStatus()).isEqualTo(DeviceStatus.DELETED);
        verify(machineRepository, never()).save(any());
    }

    @Test
    void onFailed_afterAck_machineHandedBackAsOffline() {
        // setup
        machine.setStatus(DeviceStatus.PENDING_DELETION);
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));

        // execution
        spec.onFailed(delivery, DeliveryFailure.TIMEOUT);

        // verifications
        assertThat(machine.getStatus()).isEqualTo(DeviceStatus.OFFLINE);
        verify(machineRepository).save(machine);
    }

    @Test
    void onFailed_neverAcked_machineUntouched() {
        // setup
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));

        // execution
        spec.onFailed(delivery, DeliveryFailure.EXHAUSTED);

        // verifications
        assertThat(machine.getStatus()).isEqualTo(DeviceStatus.ONLINE);
        verify(machineRepository, never()).save(any());
    }

    @Test
    void onFailed_machineAlreadyDeleted_untouched() {
        // setup
        machine.setStatus(DeviceStatus.DELETED);
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));

        // execution
        spec.onFailed(delivery, DeliveryFailure.TIMEOUT);

        // verifications
        assertThat(machine.getStatus()).isEqualTo(DeviceStatus.DELETED);
        verify(machineRepository, never()).save(any());
    }
}
