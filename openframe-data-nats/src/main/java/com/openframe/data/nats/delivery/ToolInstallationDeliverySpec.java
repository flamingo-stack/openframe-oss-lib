package com.openframe.data.nats.delivery;

import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.nats.model.ToolInstallationMessage;
import com.openframe.data.nats.publisher.ToolInstallationNatsPublisher;
import com.openframe.delivery.DeliveryRequest;
import com.openframe.delivery.DeliverySpec;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty("spring.cloud.stream.enabled")
public class ToolInstallationDeliverySpec implements DeliverySpec<ToolInstallationMessage> {

    private final ToolInstallationNatsPublisher publisher;

    // targetId is the tool agent key: the agent reports it back as agentType in installed-agent
    public DeliveryRequest<ToolInstallationMessage> request(String machineId, IntegratedToolAgent toolAgent, IntegratedTool tool, boolean reinstall) {
        ToolInstallationMessage message = publisher.buildMessage(toolAgent, tool, reinstall);
        return DeliveryRequest.<ToolInstallationMessage>builder()
                .spec(this)
                .targetId(toolAgent.getKey())
                .machineId(machineId)
                .payload(message)
                .build();
    }

    @Override
    public DeliveryType getType() {
        return DeliveryType.TOOL_INSTALLATION;
    }

    @Override
    public Class<ToolInstallationMessage> getPayloadClass() {
        return ToolInstallationMessage.class;
    }

    @Override
    public void publish(String machineId, ToolInstallationMessage payload) {
        publisher.publish(machineId, payload);
    }

    @Override
    public void onFailed(MachineDelivery delivery, DeliveryFailure failure) {
        // nothing beyond FAILED + metric: an install is safe to re-run by hand
    }
}
