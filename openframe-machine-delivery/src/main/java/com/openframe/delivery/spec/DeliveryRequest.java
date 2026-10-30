package com.openframe.delivery.spec;

import com.openframe.data.document.delivery.DeliveryType;
import lombok.Builder;
import lombok.Getter;

import java.time.Instant;

@Getter
@Builder(toBuilder = true)
public class DeliveryRequest<P extends DeliveryPayload> {
    private final DeliveryType type;
    private final String targetId;
    // the one machine, or none when the audience is every machine the type delivers to (client-service turns that
    // into a rollout)
    private final String machineId;
    @Builder.Default
    private final DeliveryAudience audience = DeliveryAudience.MACHINE;
    private final P payload;
    // when the command is due to reach the machine, recorded as the row's dueAt; none = at once
    private final Instant dueAt;

    public boolean isForEveryMachine() {
        return audience == DeliveryAudience.EVERY_MACHINE;
    }

    // a moment already past is no schedule: the command goes out the ordinary way
    public boolean isDueAfter(Instant now) {
        return dueAt != null && dueAt.isAfter(now);
    }
}
