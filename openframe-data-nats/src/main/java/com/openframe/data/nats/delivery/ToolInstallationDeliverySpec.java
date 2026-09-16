package com.openframe.data.nats.delivery;

import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.nats.model.ToolInstallationMessage;
import com.openframe.data.nats.publisher.ToolInstallationNatsPublisher;
import com.openframe.delivery.DeliveryRequest;
import com.openframe.delivery.DeliverySeed;
import com.openframe.delivery.DeliverySpec;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty("spring.cloud.stream.enabled")
public class ToolInstallationDeliverySpec implements DeliverySpec<ToolInstallationDeliverySpec.Seed, ToolInstallationMessage> {

    private final ToolInstallationNatsPublisher publisher;

    @Getter
    @AllArgsConstructor
    public static class Seed implements DeliverySeed {
        private final String machineId;
        private final IntegratedToolAgent toolAgent;
        private final IntegratedTool tool;
        private final boolean reinstall;

        @Override
        public DeliveryType type() {
            return DeliveryType.TOOL_INSTALLATION;
        }
    }

    @Override
    public DeliveryType getType() {
        return DeliveryType.TOOL_INSTALLATION;
    }

    @Override
    public Class<Seed> getSeedClass() {
        return Seed.class;
    }

    @Override
    public Class<ToolInstallationMessage> getPayloadClass() {
        return ToolInstallationMessage.class;
    }

    // targetId is the tool agent key: the agent reports it back as agentType in installed-agent
    @Override
    public DeliveryRequest<ToolInstallationMessage> request(Seed seed) {
        IntegratedToolAgent toolAgent = seed.getToolAgent();
        IntegratedTool tool = seed.getTool();
        boolean reinstall = seed.isReinstall();
        ToolInstallationMessage message = publisher.buildMessage(toolAgent, tool, reinstall);
        String targetId = toolAgent.getKey();
        return DeliveryRequest.<ToolInstallationMessage>builder()
                .type(DeliveryType.TOOL_INSTALLATION)
                .targetId(targetId)
                .machineId(seed.getMachineId())
                .payload(message)
                .build();
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
