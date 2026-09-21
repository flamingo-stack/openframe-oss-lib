package com.openframe.delivery.dispatch;

import com.openframe.delivery.spec.DeliveryRequest;

public interface DeliveryRecorder {

    void record(DeliveryRequest<?> request);
}
