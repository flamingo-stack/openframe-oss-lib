package com.openframe.delivery.dispatch;

import com.openframe.delivery.spec.DeliveryRequest;

// where a prepared request goes: client-service records and publishes it, every other service hands it to client-service
public interface DeliverySink {

    void accept(DeliveryRequest<?> request);
}
