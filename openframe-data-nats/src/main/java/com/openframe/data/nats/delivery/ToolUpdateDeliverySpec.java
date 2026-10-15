package com.openframe.data.nats.delivery;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.nats.mapper.ToolAgentUpdateMessageMapper;
import com.openframe.data.nats.model.ToolAgentUpdateMessage;
import com.openframe.delivery.spec.DeliveryRequest;
import com.openframe.delivery.spec.DeliverySpec;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import static java.lang.String.format;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty("spring.cloud.stream.enabled")
public class ToolUpdateDeliverySpec implements DeliverySpec<ToolUpdateDeliverySeed, ToolAgentUpdateMessage> {

    // one subject for every tool, the payload names it; the legacy broadcast machine.all.tool.<tool>.update and its
    // TOOL_UPDATE stream never see this one (see ToolInstallationDeliverySpec for the .v2 rule)
    private static final String SUBJECT_TEMPLATE = "machine.%s.tool-update.v2";

    private final ToolAgentUpdateMessageMapper messageMapper;

    @Override
    public DeliveryType getType() {
        return DeliveryType.TOOL_UPDATE;
    }

    @Override
    public Class<ToolAgentUpdateMessage> getPayloadClass() {
        return ToolAgentUpdateMessage.class;
    }

    @Override
    public DeliveryRequest<ToolAgentUpdateMessage> request(ToolUpdateDeliverySeed seed) {
        ToolAgentUpdateMessage message = messageMapper.toMessage(seed.getToolAgent());
        return DeliveryRequest.<ToolAgentUpdateMessage>builder()
                .type(DeliveryType.TOOL_UPDATE)
                .targetId(seed.getTargetId())
                .audience(seed.getAudience())
                .machineId(seed.getMachineId())
                .payload(message)
                .build();
    }

    @Override
    public String subject(String machineId) {
        return format(SUBJECT_TEMPLATE, machineId);
    }

    // one tool version is the same payload for every machine: a rollout, not one request per machine
    @Override
    public boolean canDeliverToEveryMachine() {
        return true;
    }
}
