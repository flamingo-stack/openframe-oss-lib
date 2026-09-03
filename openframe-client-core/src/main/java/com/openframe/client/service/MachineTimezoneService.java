package com.openframe.client.service;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.repository.device.MachineRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.ZoneId;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

import static com.openframe.data.document.device.DeviceStatus.DELETED;
import static com.openframe.data.document.device.DeviceStatus.PENDING_DELETION;
import static org.apache.commons.lang3.StringUtils.isBlank;

@Service
@RequiredArgsConstructor
@Slf4j
public class MachineTimezoneService {

    private static final Set<String> AVAILABLE_ZONES = ZoneId.getAvailableZoneIds();

    private final MachineRepository machineRepository;

    public void updateTimezone(String machineId, String timezone) {
        if (isBlank(timezone)) {
            log.warn("Timezone update for machineId={} had a blank timezone, ignoring", machineId);
            return;
        }
        if (!isValidZone(timezone)) {
            log.warn("Timezone update for machineId={} had an invalid zone id '{}', ignoring", machineId, timezone);
            return;
        }

        Optional<Machine> foundMachine = machineRepository.findByMachineId(machineId);
        if (foundMachine.isEmpty()) {
            log.warn("Timezone update for unknown machine {}, ignoring", machineId);
            return;
        }

        Machine machine = foundMachine.get();
        DeviceStatus status = machine.getStatus();
        if (status == PENDING_DELETION || status == DELETED) {
            log.debug("Ignoring timezone update for machineId={} in status {}", machineId, status);
            return;
        }

        if (Objects.equals(timezone, machine.getTimezone())) {
            log.debug("Timezone for machineId={} is already {}, nothing to update", machineId, timezone);
            return;
        }

        machine.setTimezone(timezone);
        machineRepository.save(machine);
        log.info("Updated timezone for machineId={} to {}", machineId, timezone);
    }

    private static boolean isValidZone(String timezone) {
        return AVAILABLE_ZONES.contains(timezone);
    }
}
