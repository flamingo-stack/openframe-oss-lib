package com.openframe.api.service;

import com.openframe.api.dto.force.request.ForceToolInstallationRequest;
import com.openframe.api.dto.force.response.ForceAgentStatus;
import com.openframe.api.dto.force.response.ForceToolAgentInstallationResponse;
import com.openframe.api.dto.force.response.ForceToolAgentInstallationResponseItem;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.service.IntegratedToolAgentService;
import com.openframe.data.service.ToolInstallationService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ForceToolInstallationServiceTest {

    private static final String MACHINE_ID = "mach-42";
    private static final String TOOL_AGENT_KEY = "fleetmdm-agent";

    @Mock private IntegratedToolAgentService integratedToolAgentService;
    @Mock private ToolInstallationService toolInstallationService;
    @Mock private MachineRepository machineRepository;
    @InjectMocks private ForceToolInstallationService service;

    @Test
    void process_commandSent_answersProcessedForTheDevice() {
        IntegratedToolAgent toolAgent = knownToolAgent();
        when(toolInstallationService.process(MACHINE_ID, toolAgent, false)).thenReturn(true);

        ForceToolAgentInstallationResponse response = service.process(oneDeviceRequest());

        assertThat(response.getItems())
                .extracting(ForceToolAgentInstallationResponseItem::getMachineId,
                        ForceToolAgentInstallationResponseItem::getStatus)
                .containsExactly(tuple(MACHINE_ID, ForceAgentStatus.PROCESSED));
    }

    @Test
    void process_commandNotSent_answersFailedForTheDevice() {
        IntegratedToolAgent toolAgent = knownToolAgent();
        when(toolInstallationService.process(MACHINE_ID, toolAgent, false)).thenReturn(false);

        ForceToolAgentInstallationResponse response = service.process(oneDeviceRequest());

        assertThat(response.getItems())
                .extracting(ForceToolAgentInstallationResponseItem::getMachineId,
                        ForceToolAgentInstallationResponseItem::getStatus)
                .containsExactly(tuple(MACHINE_ID, ForceAgentStatus.FAILED));
    }

    private IntegratedToolAgent knownToolAgent() {
        IntegratedToolAgent toolAgent = new IntegratedToolAgent();
        toolAgent.setKey(TOOL_AGENT_KEY);
        when(integratedToolAgentService.findByKey(TOOL_AGENT_KEY)).thenReturn(Optional.of(toolAgent));
        return toolAgent;
    }

    private static ForceToolInstallationRequest oneDeviceRequest() {
        return ForceToolInstallationRequest.builder().toolAgentId(TOOL_AGENT_KEY).machineIds(List.of(MACHINE_ID)).build();
    }
}
