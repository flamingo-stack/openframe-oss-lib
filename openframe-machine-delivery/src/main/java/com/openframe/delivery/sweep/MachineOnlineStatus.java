package com.openframe.delivery.sweep;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.TelemetryStatus;
import com.openframe.data.repository.device.MachineRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Set;

import static java.util.stream.Collectors.toMap;
import static java.util.stream.Collectors.toSet;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "openframe.delivery.sweep.enabled", havingValue = "true")
public class MachineOnlineStatus {

    private final MachineRepository machineRepository;

    public Set<String> online(Set<String> machineIds) {
        List<Machine> online = machineRepository.findByMachineIdInAndTelemetryStatus(machineIds, TelemetryStatus.ONLINE);
        return online.stream().map(Machine::getMachineId).collect(toSet());
    }

    // whether a machine may still receive a command is the spec's call; a machine the repository does not know stays absent
    public Map<String, DeviceStatus> statuses(Set<String> machineIds) {
        List<Machine> machines = machineRepository.findByMachineIdIn(machineIds);
        return machines.stream()
                .filter(machine -> machine.getStatus() != null)
                .collect(toMap(Machine::getMachineId, Machine::getStatus, (first, second) -> first));
    }
}
