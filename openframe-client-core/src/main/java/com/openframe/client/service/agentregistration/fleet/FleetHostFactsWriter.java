package com.openframe.client.service.agentregistration.fleet;

import com.openframe.data.document.device.Machine;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.service.machine.MachineField;
import com.openframe.data.service.machine.MachineUpdate;
import com.openframe.data.service.machine.MachineWriter;
import com.openframe.sdk.fleetmdm.model.Host;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Optional;

import static com.openframe.data.service.machine.MachineFields.COMPUTER_NAME;
import static com.openframe.data.service.machine.MachineFields.MANUFACTURER;
import static com.openframe.data.service.machine.MachineFields.MODEL;
import static com.openframe.data.service.machine.MachineFields.OS_UUID;
import static com.openframe.data.service.machine.MachineFields.SERIAL_NUMBER;
import static com.openframe.data.service.machine.MachineUpdate.machineUpdate;
import static org.apache.commons.lang3.StringUtils.isBlank;

// Fills the machine's hardware facts from its Fleet host where the machine has none. A value the agent reported at
// registration always wins: Fleet never overwrites one.
@Component
@RequiredArgsConstructor
@Slf4j
public class FleetHostFactsWriter {

    private final MachineRepository machineRepository;
    private final MachineWriter machineWriter;

    public void fill(String machineId, Host host) {
        Optional<Machine> machine = machineRepository.findByMachineId(machineId);
        if (machine.isEmpty()) {
            log.warn("Machine not found, Fleet host facts not filled: machineId={}", machineId);
            return;
        }
        fill(machine.get(), host);
    }

    public void fill(Machine machine, Host host) {
        MachineUpdate update = machineUpdate();
        setWhereBlank(update, SERIAL_NUMBER, machine.getSerialNumber(), host.getHardwareSerial());
        setWhereBlank(update, MODEL, machine.getModel(), host.getHardwareModel());
        setWhereBlank(update, MANUFACTURER, machine.getManufacturer(), host.getHardwareVendor());
        setWhereBlank(update, OS_UUID, machine.getOsUuid(), host.getUuid());
        setWhereBlank(update, COMPUTER_NAME, machine.getComputerName(), host.getComputerName());
        String machineId = machine.getMachineId();
        if (update.isEmpty()) {
            log.debug("No blank hardware fact Fleet can fill: machineId={}", machineId);
            return;
        }
        log.info("Filling hardware facts from Fleet: machineId={}, fields={}", machineId, update.paths());
        machineWriter.update(machineId, update);
    }

    private static void setWhereBlank(MachineUpdate update, MachineField<String> field, String stored, String fleetValue) {
        if (isBlank(stored) && !isBlank(fleetValue)) {
            update.set(field, fleetValue.trim());
        }
    }
}
