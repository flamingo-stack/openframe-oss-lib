package com.openframe.delivery;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.repository.device.MachineRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Set;

import static java.util.stream.Collectors.toSet;

// the only place the engine reads the Machine document; heartbeat-driven status today
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "openframe.delivery.enabled", havingValue = "true")
public class MachineOnlineStatus {

    private final MachineRepository machineRepository;

    public Set<String> offline(Set<String> machineIds) {
        List<Machine> offline = machineRepository.findByMachineIdInAndStatus(machineIds, DeviceStatus.OFFLINE);
        return offline.stream().map(Machine::getMachineId).collect(toSet());
    }
}
