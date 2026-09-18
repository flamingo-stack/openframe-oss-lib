package com.openframe.delivery;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.rmm.schedule.ScheduleOfflineBehavior;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class DeliveryRequest<P> {
    private final DeliveryType type;
    private final String targetId;
    private final String machineId;
    private final P payload;
    private final ScheduleOfflineBehavior offlineBehavior;
    private final Long reconnectWindowSeconds;
}
