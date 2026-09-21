package com.openframe.delivery.sweep;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.repository.device.MachineRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = {"openframe.delivery.enabled", "openframe.delivery.sweep.enabled"}, havingValue = "true")
public class MachineOnlineStatus {

    private static final Set<DeviceStatus> GONE = EnumSet.of(
            DeviceStatus.DELETED, DeviceStatus.ARCHIVED, DeviceStatus.DECOMMISSIONED);

    private final MachineRepository machineRepository;

    public Lookup lookup(Set<String> machineIds) {
        List<Machine> machines = machineRepository.findByMachineIdIn(machineIds);
        Map<String, DeviceStatus> statusById = new HashMap<>();
        machines.forEach(machine -> statusById.put(machine.getMachineId(), machine.getStatus()));
        return new Lookup(statusById);
    }

    @RequiredArgsConstructor
    public static class Lookup {

        private final Map<String, DeviceStatus> statusById;

        public boolean isGone(String machineId) {
            DeviceStatus status = statusById.get(machineId);
            return GONE.contains(status);
        }

        public boolean isOffline(String machineId) {
            return statusById.get(machineId) != DeviceStatus.ONLINE;
        }
    }
}
