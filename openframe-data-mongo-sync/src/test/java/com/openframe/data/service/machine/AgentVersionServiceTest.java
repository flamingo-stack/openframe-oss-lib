package com.openframe.data.service.machine;

import com.openframe.data.document.installedagents.InstalledAgent;
import com.openframe.data.repository.installedagents.InstalledAgentRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static com.openframe.data.service.machine.AgentVersionService.OPENFRAME_CLIENT_AGENT_TYPE;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AgentVersionServiceTest {

    @Mock private InstalledAgentRepository installedAgentRepository;
    @InjectMocks private AgentVersionService service;

    @Test
    void find_clientReported_itsVersion() {
        // setup
        when(installedAgentRepository.findByMachineIdAndAgentType("m-1", OPENFRAME_CLIENT_AGENT_TYPE))
                .thenReturn(Optional.of(installed("m-1", "1.6.2")));

        // execution
        Optional<String> version = service.find("m-1");

        // verifications
        assertThat(version).contains("1.6.2");
    }

    @Test
    void find_rowWithoutVersion_empty() {
        // setup
        when(installedAgentRepository.findByMachineIdAndAgentType("m-1", OPENFRAME_CLIENT_AGENT_TYPE))
                .thenReturn(Optional.of(installed("m-1", " ")));

        // execution
        Optional<String> version = service.find("m-1");

        // verifications
        assertThat(version).isEmpty();
    }

    @Test
    void findAll_oneLookupForTheBatch_machinesWithoutAVersionLeftOut() {
        // setup
        List<String> machineIds = List.of("m-1", "m-2", "m-3");
        when(installedAgentRepository.findByMachineIdInAndAgentType(machineIds, OPENFRAME_CLIENT_AGENT_TYPE))
                .thenReturn(List.of(installed("m-1", "1.6.2"), installed("m-2", null)));

        // execution
        Map<String, String> versions = service.findAll(machineIds);

        // verifications
        assertThat(versions).containsExactlyEntriesOf(Map.of("m-1", "1.6.2"));
    }

    private static InstalledAgent installed(String machineId, String version) {
        InstalledAgent agent = new InstalledAgent();
        agent.setMachineId(machineId);
        agent.setAgentType(OPENFRAME_CLIENT_AGENT_TYPE);
        agent.setVersion(version);
        return agent;
    }
}
