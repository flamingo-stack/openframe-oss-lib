package com.openframe.client.service;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.service.machine.MachineUpdate;
import com.openframe.data.service.machine.MachineWriteResult;
import com.openframe.data.service.machine.MachineWriter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Objects;
import java.util.Optional;

import static com.openframe.data.service.machine.MachineFields.OS_BUILD;
import static com.openframe.data.service.machine.MachineFields.OS_VERSION;
import static com.openframe.data.service.machine.MachineUpdate.machineUpdate;
import static org.apache.commons.lang3.StringUtils.isBlank;
import static org.apache.commons.lang3.StringUtils.isNotBlank;

@Service
@RequiredArgsConstructor
@Slf4j
public class MachineOsInfoService {

    private final MachineRepository machineRepository;
    private final MachineWriter machineWriter;
    private final ToolOsSupportReconciler toolOsSupportReconciler;

    public void updateOsInfo(String machineId, String osVersion, String osBuild) {
        if (isBlank(osVersion)) {
            log.warn("OS info for machineId={} had a blank version, ignoring", machineId);
            return;
        }
        Optional<Machine> foundMachine = machineRepository.findByMachineId(machineId);
        if (foundMachine.isEmpty()) {
            log.warn("OS info for unknown machine {}, ignoring", machineId);
            return;
        }
        Machine machine = foundMachine.get();
        DeviceStatus status = machine.getStatus();
        if (DeviceStatus.FROZEN.contains(status)) {
            log.debug("Ignoring OS info for machineId={} in status {}", machineId, status);
            return;
        }
        String previousOsVersion = machine.getOsVersion();
        Machine current = write(machine, osVersion, osBuild);
        toolOsSupportReconciler.reconcile(current, previousOsVersion);
    }

    private Machine write(Machine machine, String osVersion, String osBuild) {
        String machineId = machine.getMachineId();
        boolean versionUnchanged = Objects.equals(osVersion, machine.getOsVersion());
        boolean buildUnchanged = isBlank(osBuild) || Objects.equals(osBuild, machine.getOsBuild());
        if (versionUnchanged && buildUnchanged) {
            return machine;
        }
        MachineUpdate update = machineUpdate().set(OS_VERSION, osVersion);
        if (isNotBlank(osBuild)) {
            update.set(OS_BUILD, osBuild);
        }
        log.info("Updated OS info for machineId={} to version {} build {}", machineId, osVersion, osBuild);
        return machineWriter.update(machineId, update)
                .map(MachineWriteResult::after)
                .orElse(machine);
    }
}
