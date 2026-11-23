package com.openframe.data.service.machine;

import com.openframe.data.document.device.Machine;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class WithheldToolAgentsTest {

    private static final String MACHINE_ID = "m-1";
    private static final String FLEET_AGENT = "fleetmdm-agent";
    private static final String MESH_AGENT = "meshcentral-agent";

    @Mock private MachineWriter machineWriter;

    @Captor private ArgumentCaptor<MachineUpdate> updateCaptor;

    @InjectMocks private WithheldToolAgents withheldToolAgents;

    private Machine machine;

    @BeforeEach
    void setUp() {
        machine = new Machine();
        machine.setMachineId(MACHINE_ID);
    }

    @Test
    void isWithheld_agentInTheSet_true() {
        // setup
        machine.setWithheldToolAgents(Set.of(FLEET_AGENT));

        // execution
        boolean withheld = WithheldToolAgents.isWithheld(machine, FLEET_AGENT);

        // verifications
        assertThat(withheld).isTrue();
    }

    @Test
    void isWithheld_otherAgentInTheSet_false() {
        // setup
        machine.setWithheldToolAgents(Set.of(MESH_AGENT));

        // execution
        boolean withheld = WithheldToolAgents.isWithheld(machine, FLEET_AGENT);

        // verifications
        assertThat(withheld).isFalse();
    }

    @Test
    void isWithheld_noSet_false() {
        // setup
        machine.setWithheldToolAgents(null);

        // execution
        boolean withheld = WithheldToolAgents.isWithheld(machine, FLEET_AGENT);

        // verifications
        assertThat(withheld).isFalse();
    }

    @Test
    void withhold_notWithheld_agentAddedAndWrittenThroughMachineWriter() {
        // setup
        machine.setWithheldToolAgents(Set.of(MESH_AGENT));

        // execution
        withheldToolAgents.withhold(machine, FLEET_AGENT);

        // verifications
        verify(machineWriter).update(eq(MACHINE_ID), updateCaptor.capture());
        assertThat(updateCaptor.getValue().paths()).containsExactly(MachineFields.WITHHELD_TOOL_AGENTS.path());
        assertThat(writtenWithheld()).containsExactlyInAnyOrder(MESH_AGENT, FLEET_AGENT);
    }

    @Test
    void withhold_noSetYet_setCreatedWithTheAgent() {
        // setup
        machine.setWithheldToolAgents(null);

        // execution
        withheldToolAgents.withhold(machine, FLEET_AGENT);

        // verifications
        verify(machineWriter).update(eq(MACHINE_ID), updateCaptor.capture());
        assertThat(writtenWithheld()).containsExactly(FLEET_AGENT);
    }

    @Test
    void withhold_notWithheld_machineUpdatedInPlace() {
        // setup
        machine.setWithheldToolAgents(Set.of(MESH_AGENT));

        // execution
        withheldToolAgents.withhold(machine, FLEET_AGENT);

        // verifications
        assertThat(machine.getWithheldToolAgents()).containsExactlyInAnyOrder(MESH_AGENT, FLEET_AGENT);
    }

    @Test
    void withhold_alreadyWithheld_nothingWritten() {
        // setup
        machine.setWithheldToolAgents(Set.of(FLEET_AGENT));

        // execution
        withheldToolAgents.withhold(machine, FLEET_AGENT);

        // verifications
        verifyNoInteractions(machineWriter);
        assertThat(machine.getWithheldToolAgents()).containsExactly(FLEET_AGENT);
    }

    @Test
    void release_withheld_agentRemovedAndWrittenThroughMachineWriter() {
        // setup
        machine.setWithheldToolAgents(Set.of(MESH_AGENT, FLEET_AGENT));

        // execution
        withheldToolAgents.release(machine, FLEET_AGENT);

        // verifications
        verify(machineWriter).update(eq(MACHINE_ID), updateCaptor.capture());
        assertThat(updateCaptor.getValue().paths()).containsExactly(MachineFields.WITHHELD_TOOL_AGENTS.path());
        assertThat(writtenWithheld()).containsExactly(MESH_AGENT);
    }

    @Test
    void release_lastWithheldAgent_emptySetWritten() {
        // setup
        machine.setWithheldToolAgents(Set.of(FLEET_AGENT));

        // execution
        withheldToolAgents.release(machine, FLEET_AGENT);

        // verifications
        verify(machineWriter).update(eq(MACHINE_ID), updateCaptor.capture());
        assertThat(writtenWithheld()).isEmpty();
    }

    @Test
    void release_withheld_machineUpdatedInPlace() {
        // setup
        machine.setWithheldToolAgents(Set.of(MESH_AGENT, FLEET_AGENT));

        // execution
        withheldToolAgents.release(machine, FLEET_AGENT);

        // verifications
        assertThat(machine.getWithheldToolAgents()).containsExactly(MESH_AGENT);
    }

    @Test
    void release_notWithheld_nothingWritten() {
        // setup
        machine.setWithheldToolAgents(Set.of(MESH_AGENT));

        // execution
        withheldToolAgents.release(machine, FLEET_AGENT);

        // verifications
        verifyNoInteractions(machineWriter);
        assertThat(machine.getWithheldToolAgents()).containsExactly(MESH_AGENT);
    }

    @Test
    void release_noSet_nothingWritten() {
        // setup
        machine.setWithheldToolAgents(null);

        // execution
        withheldToolAgents.release(machine, FLEET_AGENT);

        // verifications
        verifyNoInteractions(machineWriter);
        assertThat(machine.getWithheldToolAgents()).isNull();
    }

    private Set<String> writtenWithheld() {
        Machine written = new Machine();
        updateCaptor.getValue().applyTo(written);
        return written.getWithheldToolAgents();
    }
}
