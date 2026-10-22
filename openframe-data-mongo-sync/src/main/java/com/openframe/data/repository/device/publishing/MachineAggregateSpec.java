package com.openframe.data.repository.device.publishing;

import com.openframe.data.document.device.Machine;
import com.openframe.publishing.api.spec.AggregateSpec;
import com.openframe.publishing.api.spec.Projection;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;

// MachineRepository publishes with this spec, and so does MachineWriter, which writes outside the repository.
@Component
@RequiredArgsConstructor
public class MachineAggregateSpec implements AggregateSpec<Machine, MachineEvent> {

    private final MachineOnTicketsProjection machineOnTickets;

    @Override
    public String getType() {
        return "machines";
    }

    @Override
    public MachineEvent toEvent(Machine machine) {
        return MachineEvent.builder()
                .machineId(machine.getMachineId())
                .hostname(machine.getHostname())
                .nickname(machine.getNickname())
                .build();
    }

    @Override
    public List<Projection<MachineEvent, ?>> projections() {
        return List.of(machineOnTickets);
    }
}
