package com.openframe.data.nats.delivery;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.nats.model.ClientUninstallMessage;
import com.openframe.delivery.spec.DeliveryRequest;
import com.openframe.delivery.spec.DeliverySpec;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Instant;

import static java.lang.String.format;

@Component
@ConditionalOnProperty("spring.cloud.stream.enabled")
public class ClientUninstallDeliverySpec implements DeliverySpec<ClientUninstallDeliverySeed, ClientUninstallMessage> {

    private static final String SUBJECT_TEMPLATE = "machine.%s.client-uninstall";

    @Override
    public DeliveryType getType() {
        return DeliveryType.CLIENT_UNINSTALL;
    }

    @Override
    public Class<ClientUninstallMessage> getPayloadClass() {
        return ClientUninstallMessage.class;
    }

    @Override
    public DeliveryRequest<ClientUninstallMessage> request(ClientUninstallDeliverySeed seed) {
        ClientUninstallMessage message = new ClientUninstallMessage();
        message.setIssuedAt(Instant.now().toString());
        return DeliveryRequest.<ClientUninstallMessage>builder()
                .type(DeliveryType.CLIENT_UNINSTALL)
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
