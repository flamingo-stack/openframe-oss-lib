package com.openframe.client.service;

import com.openframe.client.exception.MachineNotFoundException;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.installedagents.InstalledAgent;
import com.openframe.data.document.tool.ConnectionStatus;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.installedagents.InstalledAgentRepository;
import com.openframe.data.service.machine.MachineUpdate;
import com.openframe.data.service.machine.MachineWriter;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InstalledAgentServiceTest {

    private static final String MACHINE_ID = "machine-1";
    private static final String AGENT_TYPE = "openframe-client";
    private static final String VERSION = "1.6.23";
    private static final long VERSION_KEY = 1_000_006_000_023L;
    private static final String OLD_VERSION = "1.5.9";
    private static final long OLD_VERSION_KEY = 1_000_005_000_009L;
    private static final String OTHER_AGENT_TYPE = "fleetmdm-agent";

    @Mock
    private InstalledAgentRepository installedAgentRepository;

    @Mock
    private MachineRepository machineRepository;

    @Mock
    private MachineWriter machineWriter;

    @Captor
    private ArgumentCaptor<InstalledAgent> installedAgentCaptor;

    @Captor
    private ArgumentCaptor<MachineUpdate> machineUpdateCaptor;

    @InjectMocks
    private InstalledAgentService service;

    @Test
    void reproducesBug_CU17tkuw65zpy_addInstalledAgent_machineNotYetOnSecondary_agentSaved() {
        // setup
        when(machineRepository.existsByMachineId(MACHINE_ID)).thenReturn(true);
        when(installedAgentRepository.findByMachineIdAndAgentType(MACHINE_ID, AGENT_TYPE)).thenReturn(Optional.empty());

        // execution
        service.addInstalledAgent(MACHINE_ID, AGENT_TYPE, VERSION, false);

        // verifications
        verify(installedAgentRepository).save(installedAgentCaptor.capture());
        assertThat(installedAgentCaptor.getValue())
                .extracting(InstalledAgent::getMachineId, InstalledAgent::getAgentType, InstalledAgent::getVersion, InstalledAgent::getStatus)
                .containsExactly(MACHINE_ID, AGENT_TYPE, VERSION, ConnectionStatus.CONNECTED);
    }

    @Test
    void addInstalledAgent_machineMissing_throwsMachineNotFound() {
        // setup
        when(machineRepository.existsByMachineId(MACHINE_ID)).thenReturn(false);

        // execution
        MachineNotFoundException ex = assertThrows(MachineNotFoundException.class,
                () -> service.addInstalledAgent(MACHINE_ID, AGENT_TYPE, VERSION, false));

        // verifications
        assertThat(ex.getMessage()).isEqualTo("Machine not found: " + MACHINE_ID);
        verify(installedAgentRepository, never()).save(any(InstalledAgent.class));
    }

    @Test
    void addInstalledAgent_clientReportsNewVersion_machineFollowsVersionAndKey() {
        // setup
        stubKnownMachine();
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machineRunning(OLD_VERSION, OLD_VERSION_KEY)));

        // execution
        service.addInstalledAgent(MACHINE_ID, AGENT_TYPE, VERSION, false);

        // verifications
        verify(machineWriter).update(eq(MACHINE_ID), machineUpdateCaptor.capture());
        Machine written = new Machine();
        machineUpdateCaptor.getValue().applyTo(written);
        assertThat(written)
                .extracting(Machine::getAgentVersion, Machine::getAgentVersionKey)
                .containsExactly(VERSION, VERSION_KEY);
        assertThat(machineUpdateCaptor.getValue().paths()).containsExactlyInAnyOrder("agentVersion", "agentVersionKey");
    }

    @Test
    void addInstalledAgent_clientReportsUnchangedVersion_machineNotWritten() {
        // setup
        stubKnownMachine();
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machineRunning(VERSION, VERSION_KEY)));

        // execution
        service.addInstalledAgent(MACHINE_ID, AGENT_TYPE, VERSION, false);

        // verifications
        verify(machineWriter, never()).update(anyString(), any(MachineUpdate.class));
        verify(installedAgentRepository).save(any(InstalledAgent.class));
    }

    @Test
    void addInstalledAgent_sameVersionWithoutStoredKey_keyBackfilled() {
        // setup
        stubKnownMachine();
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machineRunning(VERSION, null)));

        // execution
        service.addInstalledAgent(MACHINE_ID, AGENT_TYPE, VERSION, false);

        // verifications
        verify(machineWriter).update(eq(MACHINE_ID), machineUpdateCaptor.capture());
        Machine written = new Machine();
        machineUpdateCaptor.getValue().applyTo(written);
        assertThat(written.getAgentVersionKey()).isEqualTo(VERSION_KEY);
    }

    @Test
    void addInstalledAgent_machineNotReadable_versionStillWritten() {
        // setup
        stubKnownMachine();
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.empty());

        // execution
        service.addInstalledAgent(MACHINE_ID, AGENT_TYPE, VERSION, false);

        // verifications
        verify(machineWriter).update(eq(MACHINE_ID), any(MachineUpdate.class));
    }

    @Test
    void addInstalledAgent_unparseableClientVersion_versionWrittenWithoutKey() {
        // setup
        stubKnownMachine();
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machineRunning(OLD_VERSION, OLD_VERSION_KEY)));

        // execution
        service.addInstalledAgent(MACHINE_ID, AGENT_TYPE, "nightly", false);

        // verifications
        verify(machineWriter).update(eq(MACHINE_ID), machineUpdateCaptor.capture());
        Machine written = new Machine();
        machineUpdateCaptor.getValue().applyTo(written);
        assertThat(written)
                .extracting(Machine::getAgentVersion, Machine::getAgentVersionKey)
                .containsExactly("nightly", null);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " "})
    void addInstalledAgent_blankClientVersion_machineNotTouched(String version) {
        // setup
        stubKnownMachine();

        // execution
        service.addInstalledAgent(MACHINE_ID, AGENT_TYPE, version, false);

        // verifications
        verify(machineRepository, never()).findByMachineId(anyString());
        verify(machineWriter, never()).update(anyString(), any(MachineUpdate.class));
    }

    @Test
    void addInstalledAgent_otherAgentType_machineNotTouched() {
        // setup
        when(machineRepository.existsByMachineId(MACHINE_ID)).thenReturn(true);
        when(installedAgentRepository.findByMachineIdAndAgentType(MACHINE_ID, OTHER_AGENT_TYPE)).thenReturn(Optional.empty());

        // execution
        service.addInstalledAgent(MACHINE_ID, OTHER_AGENT_TYPE, VERSION, false);

        // verifications
        verify(machineRepository, never()).findByMachineId(anyString());
        verify(machineWriter, never()).update(anyString(), any(MachineUpdate.class));
    }

    @Test
    void addInstalledAgent_machineMissing_machineNotWritten() {
        // setup
        when(machineRepository.existsByMachineId(MACHINE_ID)).thenReturn(false);

        // execution
        MachineNotFoundException ex = assertThrows(MachineNotFoundException.class,
                () -> service.addInstalledAgent(MACHINE_ID, AGENT_TYPE, VERSION, false));

        // verifications
        assertThat(ex.getMessage()).isEqualTo("Machine not found: " + MACHINE_ID);
        verify(machineWriter, never()).update(anyString(), any(MachineUpdate.class));
    }

    private void stubKnownMachine() {
        when(machineRepository.existsByMachineId(MACHINE_ID)).thenReturn(true);
        when(installedAgentRepository.findByMachineIdAndAgentType(MACHINE_ID, AGENT_TYPE)).thenReturn(Optional.empty());
    }

    private static Machine machineRunning(String version, Long versionKey) {
        Machine machine = new Machine();
        machine.setMachineId(MACHINE_ID);
        machine.setAgentVersion(version);
        machine.setAgentVersionKey(versionKey);
        return machine;
    }
}
