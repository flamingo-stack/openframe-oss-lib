package com.openframe.delivery.spec;

import com.openframe.data.document.delivery.DeliveryType;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class DeliveryRequest<P extends DeliveryPayload> {
    private final DeliveryType type;
    private final String targetId;
    private final String machineId;
    private final P payload;

    // no machine = every machine the type delivers to; client-service turns such a request into a rollout
    public boolean isForEveryMachine() {
        return machineId == null;
    }
}
