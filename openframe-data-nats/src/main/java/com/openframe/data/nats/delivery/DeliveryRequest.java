package com.openframe.data.nats.delivery;

import com.openframe.data.document.rmm.delivery.DeliveryKind;
import com.openframe.data.document.rmm.schedule.ScheduleOfflineBehavior;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class DeliveryRequest {
    private final DeliveryKind kind;
    private final String targetId;
    private final String machineId;
    private final Object payload;
    private final ScheduleOfflineBehavior offlineBehavior;
    private final Long reconnectWindowSeconds;
}
