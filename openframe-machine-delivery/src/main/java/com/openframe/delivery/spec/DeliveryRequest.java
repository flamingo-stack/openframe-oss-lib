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

    // the NATS wildcard as a machine: every machine the type delivers to; client-service turns it into a rollout
    public static final String EVERY_MACHINE = "*";

    public boolean isForEveryMachine() {
        return EVERY_MACHINE.equals(machineId);
    }
}
