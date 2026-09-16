package com.openframe.client.service.rmm.delivery;

import com.openframe.data.document.rmm.delivery.DeliveryKind;

public interface DeliveryTracker {

    void acknowledge(DeliveryKind kind, String targetId, String machineId);

    void complete(DeliveryKind kind, String targetId, String machineId);
}
