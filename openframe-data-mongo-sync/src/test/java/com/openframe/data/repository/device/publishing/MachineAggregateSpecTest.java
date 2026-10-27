package com.openframe.data.repository.device.publishing;

import com.openframe.data.document.device.Machine;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class MachineAggregateSpecTest {

    private final MachineOnTicketsProjection machineOnTickets = mock(MachineOnTicketsProjection.class);
    private final MachineAggregateSpec spec = new MachineAggregateSpec(machineOnTickets);

    @Test
    void theEvent_carriesTheBusinessIdAndTheNamesOnly() {
        Machine machine = new Machine();
        machine.setId("doc-1");
        machine.setMachineId("machine-1");
        machine.setHostname("host-1");
        machine.setNickname("Front desk");
        machine.setIp("10.0.0.1");

        MachineEvent event = spec.toEvent(machine);

        assertThat(event.getMachineId()).isEqualTo("machine-1");
        assertThat(event.getHostname()).isEqualTo("host-1");
        assertThat(event.getNickname()).isEqualTo("Front desk");
    }

    @Test
    void theSpec_isTheMachinesType_withTheTicketProjection() {
        assertThat(spec.getType()).isEqualTo("machines");
        assertThat(spec.projections()).containsExactly(machineOnTickets);
    }
}
