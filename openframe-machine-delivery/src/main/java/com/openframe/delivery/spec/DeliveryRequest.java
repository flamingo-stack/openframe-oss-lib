package com.openframe.delivery.spec;

import com.openframe.data.document.delivery.DeliveryType;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class DeliveryRequest<P extends DeliveryPayload> {
    private final DeliveryType type;
    private final String targetId;
    // the one machine, or none when the audience is every machine the type delivers to (client-service turns that
    // into a rollout)
    private final String machineId;
    @Builder.Default
    private final DeliveryAudience audience = DeliveryAudience.MACHINE;
    private final P payload;

    public boolean isForEveryMachine() {
        return audience == DeliveryAudience.EVERY_MACHINE;
    }
}
