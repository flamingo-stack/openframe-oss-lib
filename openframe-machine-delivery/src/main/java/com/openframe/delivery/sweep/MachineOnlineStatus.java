package com.openframe.delivery.sweep;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.repository.device.MachineRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.EnumSet;
import java.util.List;
import java.util.Set;

import static java.util.stream.Collectors.toSet;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "openframe.delivery.sweep.enabled", havingValue = "true")
public class MachineOnlineStatus {

    private static final Set<DeviceStatus> GONE = EnumSet.of(
            DeviceStatus.DELETED, DeviceStatus.ARCHIVED, DeviceStatus.DECOMMISSIONED);

    private final MachineRepository machineRepository;

    public Set<String> online(Set<String> machineIds) {
        List<Machine> online = machineRepository.findByMachineIdInAndStatus(machineIds, DeviceStatus.ONLINE);
        return ids(online);
    }

    public Set<String> gone(Set<String> machineIds) {
        List<Machine> gone = machineRepository.findByMachineIdInAndStatusIn(machineIds, GONE);
        return ids(gone);
    }

    private static Set<String> ids(List<Machine> machines) {
        return machines.stream().map(Machine::getMachineId).collect(toSet());
    }
}
