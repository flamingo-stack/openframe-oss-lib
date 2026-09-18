package com.openframe.delivery;

import com.openframe.data.document.delivery.DeliveryType;

final class DeliveryId {

    private static final String SEPARATOR = ":";

    private DeliveryId() {
    }

    static String of(DeliveryType type, String targetId, String machineId) {
        return type.name() + SEPARATOR + targetId + SEPARATOR + machineId;
    }
}
