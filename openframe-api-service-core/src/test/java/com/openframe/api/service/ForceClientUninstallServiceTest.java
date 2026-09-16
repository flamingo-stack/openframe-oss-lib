package com.openframe.api.service;

import com.openframe.api.dto.force.request.ForceClientUninstallRequest;
import com.openframe.api.dto.force.response.ForceAgentStatus;
import com.openframe.api.dto.force.response.ForceClientUninstallResponse;
import com.openframe.api.dto.force.response.ForceClientUninstallResponseItem;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.nats.delivery.ClientUninstallDeliverySpec;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.delivery.DeliveryDispatcher;
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

    @Mock private MachineRepository machineRepository;
    @Mock private DeliveryDispatcher deliveryDispatcher;

    @Captor private ArgumentCaptor<ClientUninstallDeliverySpec.Seed> seedCaptor;

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
    }

    @Test
    void process_onlineMachine_dispatchedAndMarkedPendingDeletion() {
        // setup
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));

        // execution
        ForceClientUninstallResponse response = service.process(request);

        // verifications
        verify(deliveryDispatcher).dispatch(seedCaptor.capture());
        assertThat(seedCaptor.getValue().getMachineId()).isEqualTo(MACHINE_ID);
        assertThat(seedCaptor.getValue().type()).isEqualTo(DeliveryType.CLIENT_UNINSTALL);
        assertThat(machine.getStatus()).isEqualTo(DeviceStatus.PENDING_DELETION);
        verify(machineRepository).save(machine);
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
        verifyNoInteractions(deliveryDispatcher);
        assertThat(response.getItems())
                .extracting(ForceClientUninstallResponseItem::getStatus)
                .containsExactly(ForceAgentStatus.FAILED);
    }
}
