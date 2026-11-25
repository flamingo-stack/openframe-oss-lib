package com.openframe.data.service;

import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.nats.delivery.route.DeviceCommandSender;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static com.openframe.data.document.audit.AuditAction.DEVICE_TOOL_AGENT_INSTALL;
import static com.openframe.data.document.audit.AuditAction.DEVICE_TOOL_AGENT_REINSTALL;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ToolInstallationServiceTest {

    private static final String MACHINE_ID = "mach-42";
    private static final Map<String, Object> FLEET_AGENT_DETAILS = Map.of("toolAgentIds", List.of("fleetmdm-agent"));

    @Mock private IntegratedToolService integratedToolService;
    @Mock private ToolCommandParamsResolver toolCommandParamsResolver;
    @Mock private DeviceCommandSender deviceCommandSender;
    @InjectMocks private ToolInstallationService service;

    @Test
    void process_installSent_answersSent() {
        when(deviceCommandSender.send(eq(DEVICE_TOOL_AGENT_INSTALL), eq(MACHINE_ID), eq(FLEET_AGENT_DETAILS), any()))
                .thenReturn(true);

        assertThat(service.process(MACHINE_ID, fleetAgent(), false)).isTrue();
    }

    @Test
    void process_reinstallSent_answersSent() {
        when(deviceCommandSender.send(eq(DEVICE_TOOL_AGENT_REINSTALL), eq(MACHINE_ID), eq(FLEET_AGENT_DETAILS), any()))
                .thenReturn(true);

        assertThat(service.process(MACHINE_ID, fleetAgent(), true)).isTrue();
    }

    @Test
    void process_commandNotSent_answersNotSent() {
        when(deviceCommandSender.send(eq(DEVICE_TOOL_AGENT_INSTALL), eq(MACHINE_ID), eq(FLEET_AGENT_DETAILS), any()))
                .thenReturn(false);

        assertThat(service.process(MACHINE_ID, fleetAgent(), false)).isFalse();
    }

    @Test
    void process_sendFails_answersNotSent() {
        when(deviceCommandSender.send(eq(DEVICE_TOOL_AGENT_INSTALL), eq(MACHINE_ID), eq(FLEET_AGENT_DETAILS), any()))
                .thenThrow(new IllegalStateException("No tool found:fleetmdm-server"));

        assertThat(service.process(MACHINE_ID, fleetAgent(), false)).isFalse();
    }

    private static IntegratedToolAgent fleetAgent() {
        IntegratedToolAgent toolAgent = new IntegratedToolAgent();
        toolAgent.setKey("fleetmdm-agent");
        toolAgent.setToolId("fleetmdm-server");
        return toolAgent;
    }
}
