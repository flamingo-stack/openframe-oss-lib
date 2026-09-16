package com.openframe.delivery;

import com.openframe.data.document.delivery.DeliveryType;

// composite _id: re-dispatching the same command overwrites its row, and the tracker finds it without an index
final class DeliveryId {

    private static final String SEPARATOR = ":";

    private DeliveryId() {
    }

    static String of(DeliveryType type, String targetId, String machineId) {
        return type.name() + SEPARATOR + targetId + SEPARATOR + machineId;
    }
}
