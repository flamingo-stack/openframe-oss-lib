package com.openframe.client.service;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.repository.device.MachineRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MachineTimezoneServiceTest {

    private static final String MACHINE_ID = "m-1";

    @Mock private MachineRepository machineRepository;
    @InjectMocks private MachineTimezoneService service;

    @Test
    @DisplayName("valid zone on a known machine: persisted")
    void validZone_persisted() {
        Machine machine = machine("UTC");
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));

        service.updateTimezone(MACHINE_ID, "Europe/Kyiv");

        assertThat(machine.getTimezone()).isEqualTo("Europe/Kyiv");
        verify(machineRepository).save(machine);
    }

    @Test
    @DisplayName("invalid zone id: ignored, machine never loaded or saved")
    void invalidZone_ignored() {
        service.updateTimezone(MACHINE_ID, "Not/AZone");

        verify(machineRepository, never()).findByMachineId(any());
        verify(machineRepository, never()).save(any());
    }

    @Test
    @DisplayName("blank timezone: ignored")
    void blank_ignored() {
        service.updateTimezone(MACHINE_ID, "  ");

        verify(machineRepository, never()).findByMachineId(any());
        verify(machineRepository, never()).save(any());
    }

    @Test
    @DisplayName("unknown machine: ignored")
    void unknownMachine_ignored() {
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.empty());

        service.updateTimezone(MACHINE_ID, "America/New_York");

        verify(machineRepository, never()).save(any());
    }

    @Test
    @DisplayName("unchanged value: no write")
    void sameValue_noSave() {
        Machine machine = machine("Europe/Kyiv");
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));

        service.updateTimezone(MACHINE_ID, "Europe/Kyiv");

        verify(machineRepository, never()).save(any());
    }

    @Test
    @DisplayName("machine pending deletion: ignored")
    void pendingDeletion_ignored() {
        Machine machine = machine("UTC");
        machine.setStatus(DeviceStatus.PENDING_DELETION);
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));

        service.updateTimezone(MACHINE_ID, "Europe/Kyiv");

        verify(machineRepository, never()).save(any());
    }

    private static Machine machine(String timezone) {
        Machine m = new Machine();
        m.setMachineId(MACHINE_ID);
        m.setStatus(DeviceStatus.ONLINE);
        m.setTimezone(timezone);
        return m;
    }
}
