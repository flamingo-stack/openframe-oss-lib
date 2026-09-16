package com.openframe.data.nats.delivery;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.nats.model.ToolInstallationMessage;
import com.openframe.data.nats.publisher.ToolInstallationNatsPublisher;
import com.openframe.delivery.DeliveryRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ToolInstallationDeliverySpecTest {

    private static final String MACHINE_ID = "mach-42";
    private static final String TOOL_AGENT_KEY = "tactical-agent";

    @Mock private ToolInstallationNatsPublisher publisher;

    @InjectMocks private ToolInstallationDeliverySpec spec;

    private IntegratedToolAgent toolAgent;
    private IntegratedTool tool;
    private ToolInstallationMessage message;

    @BeforeEach
    void setUp() {
        toolAgent = new IntegratedToolAgent();
        toolAgent.setKey(TOOL_AGENT_KEY);
        tool = new IntegratedTool();
        message = new ToolInstallationMessage();
        message.setToolAgentId(TOOL_AGENT_KEY);
    }

    @Test
    void request_toolAgent_targetIsAgentKeyAndPayloadBuiltByPublisher() {
        // setup
        when(publisher.buildMessage(toolAgent, tool, true)).thenReturn(message);

        // execution
        ToolInstallationDeliverySpec.Seed seed = new ToolInstallationDeliverySpec.Seed(MACHINE_ID, toolAgent, tool, true);
        DeliveryRequest<ToolInstallationMessage> request = spec.request(seed);

        // verifications
        assertThat(request.getType()).isEqualTo(DeliveryType.TOOL_INSTALLATION);
        assertThat(request.getTargetId()).isEqualTo(TOOL_AGENT_KEY);
        assertThat(request.getMachineId()).isEqualTo(MACHINE_ID);
        assertThat(request.getPayload()).isSameAs(message);
    }

    @Test
    void publish_payload_delegatedToPublisher() {
        // setup

        // execution
        spec.publish(MACHINE_ID, message);

        // verifications
        verify(publisher).publish(MACHINE_ID, message);
    }
}
