package com.openframe.data.nats.delivery;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.nats.mapper.OpenFrameClientUpdateMessageMapper;
import com.openframe.data.nats.model.OpenFrameClientUpdateMessage;
import com.openframe.delivery.spec.DeliveryRequest;
import com.openframe.delivery.spec.DeliverySpec;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import static java.lang.String.format;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty("spring.cloud.stream.enabled")
public class ClientUpdateDeliverySpec implements DeliverySpec<ClientUpdateDeliverySeed, OpenFrameClientUpdateMessage> {

    private static final String SUBJECT_TEMPLATE = "machine.%s.client-update";

    private final OpenFrameClientUpdateMessageMapper messageMapper;

    @Override
    public DeliveryType getType() {
        return DeliveryType.CLIENT_UPDATE;
    }

    @Override
    public Class<OpenFrameClientUpdateMessage> getPayloadClass() {
        return OpenFrameClientUpdateMessage.class;
    }

    @Override
    public DeliveryRequest<OpenFrameClientUpdateMessage> request(ClientUpdateDeliverySeed seed) {
        OpenFrameClientUpdateMessage message = messageMapper.toMessage(seed.getConfiguration());
        return DeliveryRequest.<OpenFrameClientUpdateMessage>builder()
                .type(DeliveryType.CLIENT_UPDATE)
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

    // one release is the same payload for every machine: a rollout, not one request per machine
    @Override
    public boolean canDeliverToEveryMachine() {
        return true;
    }
}
