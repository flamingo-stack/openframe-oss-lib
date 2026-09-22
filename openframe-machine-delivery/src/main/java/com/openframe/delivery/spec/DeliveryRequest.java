package com.openframe.delivery.spec;

import com.openframe.data.document.delivery.DeliveryType;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class DeliveryRequest<P> {
    private final DeliveryType type;
    private final String targetId;
    private final String machineId;
    private final P payload;
}
