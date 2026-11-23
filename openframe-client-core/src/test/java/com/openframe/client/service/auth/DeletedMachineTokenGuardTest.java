package com.openframe.client.service.auth;

import com.openframe.client.exception.MachineDeletedException;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.repository.device.MachineRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeletedMachineTokenGuardTest {

    private static final String MACHINE_ID = "machine-1";

    @Mock private MachineRepository machineRepository;

    private DeletedMachineTokenGuard guard;
    private Machine machine;

    @BeforeEach
    void setUp() {
        guard = new DeletedMachineTokenGuard(machineRepository, true);
        machine = new Machine();
        machine.setMachineId(MACHINE_ID);
    }

    @Test
    void requireNotDeleted_deletedMachine_throwsMachineDeleted() {
        // setup
        machine.setStatus(DeviceStatus.DELETED);
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));

        // execution
        MachineDeletedException ex = assertThrows(MachineDeletedException.class,
                () -> guard.requireNotDeleted(MACHINE_ID));

        // verifications
        assertThat(ex.getMessage()).isEqualTo(DeletedMachineTokenGuard.MACHINE_DELETED);
    }

    @ParameterizedTest
    @EnumSource(value = DeviceStatus.class, names = "DELETED", mode = EnumSource.Mode.EXCLUDE)
    void requireNotDeleted_machineNotDeleted_passes(DeviceStatus status) {
        // setup
        machine.setStatus(status);
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));

        // execution
        Runnable call = () -> guard.requireNotDeleted(MACHINE_ID);

        // verifications
        assertThatCode(call::run).doesNotThrowAnyException();
    }

    @Test
    void requireNotDeleted_machineNotFound_passes() {
        // setup
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.empty());

        // execution
        guard.requireNotDeleted(MACHINE_ID);

        // verifications
        verify(machineRepository).findByMachineId(MACHINE_ID);
    }

    @Test
    void requireNotDeleted_nullMachineId_passesWithoutLookup() {
        // setup
        String machineId = null;

        // execution
        guard.requireNotDeleted(machineId);

        // verifications
        verifyNoInteractions(machineRepository);
    }

    @Test
    void requireNotDeleted_flagOff_passesWithoutLookup() {
        // setup
        DeletedMachineTokenGuard disabled = new DeletedMachineTokenGuard(machineRepository, false);

        // execution
        disabled.requireNotDeleted(MACHINE_ID);

        // verifications
        verifyNoInteractions(machineRepository);
    }
}
