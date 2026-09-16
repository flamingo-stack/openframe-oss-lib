package com.openframe.data.nats.delivery;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

// flag off = today's behaviour: publish without a row, so callers keep a single code path
@Component
@ConditionalOnProperty(name = "openframe.rmm.delivery.enabled", havingValue = "false", matchIfMissing = true)
public class PublishOnlyDeliveryDispatch implements DeliveryDispatch {

    @Override
    public void send(DeliveryRequest request, Runnable publish) {
        publish.run();
    }
}
