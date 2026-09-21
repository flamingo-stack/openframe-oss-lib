package com.openframe.delivery.dispatch;

import com.openframe.delivery.spec.DeliveryRequest;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "openframe.delivery.enabled", havingValue = "false", matchIfMissing = true)
public class NoopDeliveryRecorder implements DeliveryRecorder {

    @Override
    public void record(DeliveryRequest<?> request) {
    }
}
