package com.openframe.delivery.track;

import com.openframe.data.document.delivery.DeliveryType;

public record DeliveryDoneEvent(DeliveryType type, String targetId, String machineId) {
}
