package com.openframe.client.service;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.repository.device.MachineRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Optional;

import static com.openframe.data.document.device.DeviceStatus.DELETED;
import static com.openframe.data.document.device.DeviceStatus.PENDING_DELETION;

@Service
@RequiredArgsConstructor
@Slf4j
public class MachineHostnameService {

    private final MachineRepository machineRepository;

    public void updateHostname(String machineId, String hostname) {
        Optional<Machine> foundMachine = machineRepository.findByMachineId(machineId);
        if (foundMachine.isEmpty()) {
            log.warn("Hostname update for unknown machine {}, ignoring", machineId);
            return;
        }

        Machine machine = foundMachine.get();
        DeviceStatus status = machine.getStatus();
        if (status == PENDING_DELETION || status == DELETED) {
            log.debug("Ignoring hostname update for machineId={} in status {}", machineId, status);
            return;
        }

        if (hostname.equals(machine.getHostname())) {
            log.debug("Hostname for machineId={} is already {}, nothing to update", machineId, hostname);
            return;
        }

        machine.setHostname(hostname);
        machineRepository.save(machine);

        log.info("Updated hostname for machineId={} to {}", machineId, hostname);
    }
}
