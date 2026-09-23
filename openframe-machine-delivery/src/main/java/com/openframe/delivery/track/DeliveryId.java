package com.openframe.delivery.track;

import com.openframe.data.document.delivery.DeliveryType;
import lombok.experimental.UtilityClass;

@UtilityClass
public class DeliveryId {

    private final String SEPARATOR = ":";

    public String of(DeliveryType type, String targetId, String machineId) {
        return type.name() + SEPARATOR + targetId + SEPARATOR + machineId;
    }
}
