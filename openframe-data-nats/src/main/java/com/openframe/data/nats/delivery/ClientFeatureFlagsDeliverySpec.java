package com.openframe.data.nats.delivery;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.nats.model.ClientFeatureFlagsMessage;
import com.openframe.delivery.spec.DeliveryRequest;
import com.openframe.delivery.spec.DeliverySpec;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import static java.lang.String.format;

@Component
@ConditionalOnProperty("spring.cloud.stream.enabled")
public class ClientFeatureFlagsDeliverySpec implements DeliverySpec<ClientFeatureFlagsDeliverySeed, ClientFeatureFlagsMessage> {

    private static final String SUBJECT_TEMPLATE = "machine.%s.feature-flags";

    @Override
    public DeliveryType getType() {
        return DeliveryType.CLIENT_FEATURE_FLAGS;
    }

    @Override
    public Class<ClientFeatureFlagsMessage> getPayloadClass() {
        return ClientFeatureFlagsMessage.class;
    }

    @Override
    public DeliveryRequest<ClientFeatureFlagsMessage> request(ClientFeatureFlagsDeliverySeed seed) {
        ClientFeatureFlagsMessage message = new ClientFeatureFlagsMessage();
        message.setFlags(seed.getFlags());
        return DeliveryRequest.<ClientFeatureFlagsMessage>builder()
                .type(DeliveryType.CLIENT_FEATURE_FLAGS)
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

    // one release is the same set of switches for every machine: a rollout, not one request per machine
    @Override
    public boolean canDeliverToEveryMachine() {
        return true;
    }
}
