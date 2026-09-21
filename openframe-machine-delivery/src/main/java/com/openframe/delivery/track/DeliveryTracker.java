package com.openframe.delivery.track;

import com.openframe.data.document.delivery.DeliveryType;

public interface DeliveryTracker {

    void acknowledge(DeliveryType type, String targetId, String machineId);

    void complete(DeliveryType type, String targetId, String machineId);

    void cancel(DeliveryType type, String targetId, String machineId);

    void wake(String machineId);
}
