package com.openframe.data.nats.delivery;

import com.openframe.data.document.clientconfiguration.OpenFrameClientConfiguration;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.delivery.spec.DeliveryAudience;
import com.openframe.delivery.spec.DeliverySeed;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor(access = AccessLevel.PRIVATE)
public class ClientUpdateDeliverySeed implements DeliverySeed {

    private final DeliveryAudience audience;
    private final String machineId;
    private final OpenFrameClientConfiguration configuration;

    public static ClientUpdateDeliverySeed forMachine(String machineId, OpenFrameClientConfiguration configuration) {
        return new ClientUpdateDeliverySeed(DeliveryAudience.MACHINE, machineId, configuration);
    }

    public static ClientUpdateDeliverySeed forEveryMachine(OpenFrameClientConfiguration configuration) {
        return new ClientUpdateDeliverySeed(DeliveryAudience.EVERY_MACHINE, null, configuration);
    }

    @Override
    public DeliveryType getType() {
        return DeliveryType.CLIENT_UPDATE;
    }

    @Override
    public String getTargetId() {
        return OpenFrameClientTarget.ID;
    }
}
