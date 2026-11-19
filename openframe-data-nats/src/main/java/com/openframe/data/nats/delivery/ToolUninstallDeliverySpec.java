package com.openframe.data.nats.delivery;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.nats.model.ToolUninstallMessage;
import com.openframe.delivery.spec.DeliveryRequest;
import com.openframe.delivery.spec.DeliverySpec;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import static java.lang.String.format;

@Component
@ConditionalOnProperty("spring.cloud.stream.enabled")
public class ToolUninstallDeliverySpec implements DeliverySpec<ToolUninstallDeliverySeed, ToolUninstallMessage> {

    private static final String SUBJECT_TEMPLATE = "machine.%s.tool-uninstall.v2";

    @Override
    public DeliveryType getType() {
        return DeliveryType.TOOL_UNINSTALL;
    }

    @Override
    public Class<ToolUninstallMessage> getPayloadClass() {
        return ToolUninstallMessage.class;
    }

    @Override
    public DeliveryRequest<ToolUninstallMessage> request(ToolUninstallDeliverySeed seed) {
        ToolUninstallMessage message = new ToolUninstallMessage();
        message.setToolAgentId(seed.getToolAgentId());
        message.setToolType(seed.getToolType());
        return DeliveryRequest.<ToolUninstallMessage>builder()
                .type(DeliveryType.TOOL_UNINSTALL)
                .targetId(seed.getTargetId())
                .machineId(seed.getMachineId())
                .payload(message)
                .build();
    }

    @Override
    public String subject(String machineId) {
        return format(SUBJECT_TEMPLATE, machineId);
    }
}
