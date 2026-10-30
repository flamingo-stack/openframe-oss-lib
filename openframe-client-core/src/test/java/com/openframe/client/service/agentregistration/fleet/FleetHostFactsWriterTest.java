package com.openframe.client.service.agentregistration.fleet;

import com.openframe.data.document.device.Machine;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.service.machine.MachineUpdate;
import com.openframe.data.service.machine.MachineWriter;
import com.openframe.sdk.fleetmdm.model.Host;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FleetHostFactsWriterTest {

    private static final String MACHINE_ID = "m-1";

    @Mock
    private MachineRepository machineRepository;

    @Mock
    private MachineWriter machineWriter;

    @Captor
    private ArgumentCaptor<MachineUpdate> updateCaptor;

    @InjectMocks
    private FleetHostFactsWriter writer;

    @Test
    void fill_machineWithoutFacts_everyFleetFactWritten() {
        // setup
        Machine machine = machine();
        Host host = fleetHost();

        // execution
        writer.fill(machine, host);

        // verifications
        verify(machineWriter).update(eq(MACHINE_ID), updateCaptor.capture());
        MachineUpdate update = updateCaptor.getValue();
        assertThat(update.paths()).containsExactly("serialNumber", "model", "manufacturer", "osUuid", "computerName");
        Machine written = new Machine();
        update.applyTo(written);
        assertThat(written).extracting(Machine::getSerialNumber, Machine::getModel, Machine::getManufacturer,
                        Machine::getOsUuid, Machine::getComputerName)
                .containsExactly("C02XG2JHJG5H", "MacBookPro18,3", "Apple Inc.",
                        "6F1A2B3C-0000-4D5E-8F90-123456789ABC", "Jane's MacBook Pro");
    }

    @Test
    void fill_storedFacts_keptAndOnlyTheBlankOnesWritten() {
        // setup
        Machine machine = machine();
        machine.setSerialNumber("FROM-AGENT");
        machine.setModel(" ");
        machine.setManufacturer("Apple Inc.");
        machine.setOsUuid("FROM-AGENT-UUID");
        Host host = fleetHost();

        // execution
        writer.fill(machine, host);

        // verifications
        verify(machineWriter).update(eq(MACHINE_ID), updateCaptor.capture());
        assertThat(updateCaptor.getValue().paths()).containsExactly("model", "computerName");
    }

    @Test
    void fill_paddedFleetValue_writtenTrimmed() {
        // setup
        Machine machine = machine();
        Host host = new Host();
        host.setHardwareSerial("  C02XG2JHJG5H \n");

        // execution
        writer.fill(machine, host);

        // verifications
        verify(machineWriter).update(eq(MACHINE_ID), updateCaptor.capture());
        Machine written = new Machine();
        updateCaptor.getValue().applyTo(written);
        assertThat(written.getSerialNumber()).isEqualTo("C02XG2JHJG5H");
    }

    @Test
    void fill_fleetHostWithoutFacts_nothingWritten() {
        // setup
        Machine machine = machine();
        Host host = new Host();
        host.setHardwareSerial(" ");

        // execution
        writer.fill(machine, host);

        // verifications
        verifyNoInteractions(machineWriter);
    }

    @Test
    void fill_byMachineId_storedMachineFilled() {
        // setup
        Host host = fleetHost();
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine()));

        // execution
        writer.fill(MACHINE_ID, host);

        // verifications
        verify(machineWriter).update(eq(MACHINE_ID), any(MachineUpdate.class));
    }

    @Test
    void fill_byMachineIdOfAnUnknownMachine_nothingWritten() {
        // setup
        Host host = fleetHost();
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.empty());

        // execution
        writer.fill(MACHINE_ID, host);

        // verifications
        verifyNoInteractions(machineWriter);
    }

    private static Machine machine() {
        Machine machine = new Machine();
        machine.setMachineId(MACHINE_ID);
        return machine;
    }

    private static Host fleetHost() {
        Host host = new Host();
        host.setHardwareSerial("C02XG2JHJG5H");
        host.setHardwareModel("MacBookPro18,3");
        host.setHardwareVendor("Apple Inc.");
        host.setUuid("6F1A2B3C-0000-4D5E-8F90-123456789ABC");
        host.setComputerName("Jane's MacBook Pro");
        return host;
    }
}
