package com.openframe.data.nats.delivery;

import com.openframe.data.document.clientconfiguration.ClientFeatureFlag;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.delivery.spec.DeliveryAudience;
import com.openframe.delivery.spec.DeliverySeed;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

import java.util.Map;

@Getter
@RequiredArgsConstructor(access = AccessLevel.PRIVATE)
public class ClientFeatureFlagsDeliverySeed implements DeliverySeed {

    private final DeliveryAudience audience;
    private final String machineId;
    private final Map<String, ClientFeatureFlag> flags;

    public static ClientFeatureFlagsDeliverySeed forMachine(String machineId, Map<String, ClientFeatureFlag> flags) {
        return new ClientFeatureFlagsDeliverySeed(DeliveryAudience.MACHINE, machineId, flags);
    }

    public static ClientFeatureFlagsDeliverySeed forEveryMachine(Map<String, ClientFeatureFlag> flags) {
        return new ClientFeatureFlagsDeliverySeed(DeliveryAudience.EVERY_MACHINE, null, flags);
    }

    @Override
    public DeliveryType getType() {
        return DeliveryType.CLIENT_FEATURE_FLAGS;
    }

    @Override
    public String getTargetId() {
        return OpenFrameClientTarget.ID;
    }
}
