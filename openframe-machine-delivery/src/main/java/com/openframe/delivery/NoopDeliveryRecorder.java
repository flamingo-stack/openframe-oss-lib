package com.openframe.delivery;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "openframe.delivery.enabled", havingValue = "false", matchIfMissing = true)
public class NoopDeliveryRecorder implements DeliveryRecorder {

    @Override
    public void record(DeliveryRequest<?> request) {
    }
}
