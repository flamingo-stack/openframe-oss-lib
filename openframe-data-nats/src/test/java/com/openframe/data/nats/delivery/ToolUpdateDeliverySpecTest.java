package com.openframe.data.nats.delivery;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.nats.mapper.ToolAgentUpdateMessageMapper;
import com.openframe.data.nats.model.ToolAgentUpdateMessage;
import com.openframe.delivery.spec.DeliveryAudience;
import com.openframe.delivery.spec.DeliveryRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ToolUpdateDeliverySpecTest {

    private static final String MACHINE_ID = "mach-42";
    private static final String TOOL_AGENT_KEY = "fleetmdm-agent";

    @Mock private ToolAgentUpdateMessageMapper messageMapper;
    @InjectMocks private ToolUpdateDeliverySpec spec;

    private IntegratedToolAgent toolAgent;
    private ToolAgentUpdateMessage message;

    @BeforeEach
    void setUp() {
        toolAgent = new IntegratedToolAgent();
        toolAgent.setKey(TOOL_AGENT_KEY);
        toolAgent.setVersion("1.2.3");
        message = new ToolAgentUpdateMessage();
    }

    @Test
    void request_seedForOneMachine_requestToThatMachineForThatTool() {
        // setup
        when(messageMapper.toMessage(toolAgent)).thenReturn(message);
        ToolUpdateDeliverySeed seed = ToolUpdateDeliverySeed.forMachine(MACHINE_ID, toolAgent);

        // execution
        DeliveryRequest<ToolAgentUpdateMessage> request = spec.request(seed);

        // verifications
        assertThat(request.getType()).isEqualTo(DeliveryType.TOOL_UPDATE);
        assertThat(request.getTargetId()).isEqualTo(TOOL_AGENT_KEY);
        assertThat(request.getAudience()).isEqualTo(DeliveryAudience.MACHINE);
        assertThat(request.getMachineId()).isEqualTo(MACHINE_ID);
        assertThat(request.getPayload()).isSameAs(message);
        assertThat(request.getPayload().getDelivery()).isNull();
    }

    @Test
    void request_seedForEveryMachine_requestForEveryMachineWithoutAMachine() {
        // setup
        when(messageMapper.toMessage(toolAgent)).thenReturn(message);
        ToolUpdateDeliverySeed seed = ToolUpdateDeliverySeed.forEveryMachine(toolAgent);

        // execution
        DeliveryRequest<ToolAgentUpdateMessage> request = spec.request(seed);

        // verifications
        assertThat(request.isForEveryMachine()).isTrue();
        assertThat(request.getMachineId()).isNull();
        assertThat(request.getTargetId()).isEqualTo(TOOL_AGENT_KEY);
    }

    @Test
    void canDeliverToEveryMachine_toolUpdate_true() {
        // execution + verifications
        assertThat(spec.canDeliverToEveryMachine()).isTrue();
    }

    @Test
    void getDeliverableStatuses_default_machineBeingDeletedGetsNoUpdate() {
        // execution
        Set<DeviceStatus> statuses = spec.getDeliverableStatuses();

        // verifications
        assertThat(statuses).containsExactlyInAnyOrder(DeviceStatus.ONLINE, DeviceStatus.OFFLINE, DeviceStatus.PENDING);
    }

    @Test
    void subject_machineId_oneToolUpdateSubjectPerMachine() {
        // execution
        String subject = spec.subject(MACHINE_ID);

        // verifications
        assertThat(subject).isEqualTo("machine.mach-42.tool-update.v2");
    }
}
