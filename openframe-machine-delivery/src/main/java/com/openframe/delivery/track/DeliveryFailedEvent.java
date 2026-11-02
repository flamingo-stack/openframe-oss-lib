package com.openframe.delivery.track;

import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryType;

// published once a delivery is FAILED for good (no re-run left), so the domain that sent it can close its own record
public record DeliveryFailedEvent(DeliveryType type, String targetId, String machineId, DeliveryFailure failure) {
}
