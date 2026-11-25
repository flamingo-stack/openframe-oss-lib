package com.openframe.client.service;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.service.machine.MachineUpdate;
import com.openframe.data.service.machine.MachineWriteResult;
import com.openframe.data.service.machine.MachineWriter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MachineOsInfoServiceTest {

    private static final String MACHINE_ID = "m-1";
    private static final String OLD_VERSION = "12.7.6";
    private static final String OLD_BUILD = "21H1320";
    private static final String NEW_VERSION = "13.6.1";
    private static final String NEW_BUILD = "22G313";

    @Mock private MachineRepository machineRepository;
    @Mock private MachineWriter machineWriter;
    @Mock private ToolOsSupportReconciler toolOsSupportReconciler;

    @Captor private ArgumentCaptor<MachineUpdate> updateCaptor;

    @InjectMocks private MachineOsInfoService service;

    private Machine machine;

    @BeforeEach
    void setUp() {
        machine = new Machine();
        machine.setMachineId(MACHINE_ID);
        machine.setStatus(DeviceStatus.MANAGED);
        machine.setOsVersion(OLD_VERSION);
        machine.setOsBuild(OLD_BUILD);
    }

    @Test
    void updateOsInfo_versionAndBuildChanged_bothWritten() {
        // setup
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));

        // execution
        service.updateOsInfo(MACHINE_ID, NEW_VERSION, NEW_BUILD);

        // verifications
        verify(machineWriter).update(eq(MACHINE_ID), updateCaptor.capture());
        assertThat(updateCaptor.getValue().paths()).containsExactly("osVersion", "osBuild");
        Machine written = new Machine();
        updateCaptor.getValue().applyTo(written);
        assertThat(written)
                .extracting(Machine::getOsVersion, Machine::getOsBuild)
                .containsExactly(NEW_VERSION, NEW_BUILD);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " "})
    void updateOsInfo_versionChangedBlankBuild_onlyVersionWritten(String osBuild) {
        // setup
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));

        // execution
        service.updateOsInfo(MACHINE_ID, NEW_VERSION, osBuild);

        // verifications
        verify(machineWriter).update(eq(MACHINE_ID), updateCaptor.capture());
        assertThat(updateCaptor.getValue().paths()).containsExactly("osVersion");
    }

    @Test
    void updateOsInfo_onlyBuildChanged_versionAndBuildWritten() {
        // setup
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));

        // execution
        service.updateOsInfo(MACHINE_ID, OLD_VERSION, NEW_BUILD);

        // verifications
        verify(machineWriter).update(eq(MACHINE_ID), updateCaptor.capture());
        assertThat(updateCaptor.getValue().paths()).containsExactly("osVersion", "osBuild");
    }

    @Test
    void updateOsInfo_written_reconcilerGetsTheMachineAfterTheWrite() {
        // setup
        Machine after = new Machine();
        after.setMachineId(MACHINE_ID);
        after.setOsVersion(NEW_VERSION);
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
        when(machineWriter.update(eq(MACHINE_ID), any(MachineUpdate.class)))
                .thenReturn(Optional.of(new MachineWriteResult(machine, after)));

        // execution
        service.updateOsInfo(MACHINE_ID, NEW_VERSION, NEW_BUILD);

        // verifications
        verify(toolOsSupportReconciler).reconcile(after);
    }

    @Test
    void updateOsInfo_writeMatchedNothing_reconcilerGetsTheLoadedMachine() {
        // setup
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
        when(machineWriter.update(eq(MACHINE_ID), any(MachineUpdate.class))).thenReturn(Optional.empty());

        // execution
        service.updateOsInfo(MACHINE_ID, NEW_VERSION, NEW_BUILD);

        // verifications
        verify(toolOsSupportReconciler).reconcile(machine);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " ", OLD_BUILD})
    void updateOsInfo_unchanged_nothingWrittenButReconciled(String osBuild) {
        // setup
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));

        // execution
        service.updateOsInfo(MACHINE_ID, OLD_VERSION, osBuild);

        // verifications
        verify(machineWriter, never()).update(anyString(), any(MachineUpdate.class));
        verify(toolOsSupportReconciler).reconcile(machine);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " "})
    void updateOsInfo_blankVersion_nothingLoadedWrittenOrReconciled(String osVersion) {
        // setup

        // execution
        service.updateOsInfo(MACHINE_ID, osVersion, NEW_BUILD);

        // verifications
        verifyNoInteractions(machineRepository, machineWriter, toolOsSupportReconciler);
    }

    @Test
    void updateOsInfo_unknownMachine_nothingWrittenOrReconciled() {
        // setup
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.empty());

        // execution
        service.updateOsInfo(MACHINE_ID, NEW_VERSION, NEW_BUILD);

        // verifications
        verifyNoInteractions(machineWriter, toolOsSupportReconciler);
    }

    @ParameterizedTest
    @EnumSource(value = DeviceStatus.class, names = {"PENDING_DELETION", "DELETED", "ARCHIVED"})
    void updateOsInfo_frozenMachine_nothingWrittenOrReconciled(DeviceStatus status) {
        // setup
        machine.setStatus(status);
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));

        // execution
        service.updateOsInfo(MACHINE_ID, NEW_VERSION, NEW_BUILD);

        // verifications
        verifyNoInteractions(machineWriter, toolOsSupportReconciler);
    }
}
