package com.openframe.api.service;

import com.openframe.api.dto.force.request.ForceClientUninstallRequest;
import com.openframe.api.dto.force.response.ForceAgentStatus;
import com.openframe.api.dto.force.response.ForceClientUninstallResponse;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.nats.delivery.ClientUninstallDeliverySeed;
import com.openframe.data.nats.delivery.route.DeliveryRouter;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.service.machine.MachineUpdate;
import com.openframe.data.service.machine.MachineWriter;
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
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ForceClientUninstallServiceTest {

    private static final String MACHINE_ID = "mach-42";

    @Mock private MachineRepository machineRepository;
    @Mock private DeliveryRouter deliveryRouter;
    @Mock private MachineWriter machineWriter;
    @Captor private ArgumentCaptor<MachineUpdate> updateCaptor;
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
    void process_routeCarriesIt_sentAndMarkedPendingDeletion() {
        // setup
        when(deliveryRouter.dispatch(any())).thenReturn(true);

        // execution
        ForceClientUninstallResponse response = service.process(request);

        // verifications
        verify(deliveryRouter).dispatch(seedCaptor.capture());
        assertThat(seedCaptor.getValue().getMachineId()).isEqualTo(MACHINE_ID);
        verify(machineWriter).update(eq(MACHINE_ID), updateCaptor.capture());
        assertThat(updateCaptor.getValue().paths()).containsExactly("status");
        updateCaptor.getValue().applyTo(machine);
        assertThat(machine.getStatus()).isEqualTo(DeviceStatus.PENDING_DELETION);
        verify(machineRepository, never()).save(any());
        assertThat(response.getItems().get(0).getStatus()).isEqualTo(ForceAgentStatus.PROCESSED);
    }

    @Test
    void process_noRouteReachesTheMachine_failedAndStatusLeftAlone() {
        // setup
        when(deliveryRouter.dispatch(any())).thenReturn(false);

        // execution
        ForceClientUninstallResponse response = service.process(request);

        // verifications
        verify(machineWriter, never()).update(anyString(), any(MachineUpdate.class));
        assertThat(response.getItems().get(0).getStatus()).isEqualTo(ForceAgentStatus.FAILED);
    }

    @Test
    void process_machineAlreadyDeleted_skipped() {
        // setup
        machine.setStatus(DeviceStatus.DELETED);

        // execution
        ForceClientUninstallResponse response = service.process(request);

        // verifications
        verify(deliveryRouter, never()).dispatch(any());
        assertThat(response.getItems().get(0).getStatus()).isEqualTo(ForceAgentStatus.FAILED);
    }
}
