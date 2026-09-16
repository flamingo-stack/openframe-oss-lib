package com.openframe.delivery;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

// flag off = today's behaviour: publish without a row, so callers keep a single code path
@Component
@ConditionalOnProperty(name = "openframe.delivery.enabled", havingValue = "false", matchIfMissing = true)
public class PublishOnlyDeliveryDispatch implements DeliveryDispatch {

    @Override
    public void send(DeliveryRequest<?> request) {
        publish(request);
    }

    private <P> void publish(DeliveryRequest<P> request) {
        DeliverySpec<P> spec = request.getSpec();
        spec.publish(request.getMachineId(), request.getPayload());
    }
}
