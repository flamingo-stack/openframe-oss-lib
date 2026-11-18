package com.openframe.data.repository.device.publishing;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class MachineAggregateSpecTest {

    private final MachineOnTicketsProjection machineOnTickets = mock(MachineOnTicketsProjection.class);
    private final MachineOnClientTicketsProjection machineOnClientTickets = mock(MachineOnClientTicketsProjection.class);
    private final MachineAggregateSpec spec = new MachineAggregateSpec(machineOnTickets, machineOnClientTickets);

    @Test
    void theEvent_carriesTheBusinessIdTheNamesTheOrganizationAndTheStatusOnly() {
        Machine machine = new Machine();
        machine.setId("doc-1");
        machine.setMachineId("machine-1");
        machine.setHostname("host-1");
        machine.setNickname("Front desk");
        machine.setOrganizationId("org-b");
        machine.setIp("10.0.0.1");
        machine.setStatus(DeviceStatus.DELETED);

        MachineEvent event = spec.toEvent(machine);

        assertThat(event.getMachineId()).isEqualTo("machine-1");
        assertThat(event.getHostname()).isEqualTo("host-1");
        assertThat(event.getNickname()).isEqualTo("Front desk");
        assertThat(event.getOrganizationId()).isEqualTo("org-b");
        assertThat(event.getStatus()).isEqualTo(DeviceStatus.DELETED);
    }

    @Test
    void theSpec_isTheMachinesType_withTheTicketProjections() {
        assertThat(spec.getType()).isEqualTo("machines");
        assertThat(spec.projections()).containsExactly(machineOnTickets, machineOnClientTickets);
    }
}
