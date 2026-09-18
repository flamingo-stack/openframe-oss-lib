package com.openframe.delivery;

import com.openframe.data.document.delivery.DeliveryType;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "openframe.delivery.enabled", havingValue = "false", matchIfMissing = true)
public class NoopDeliveryTracker implements DeliveryTracker {

    @Override
    public void acknowledge(DeliveryType type, String targetId, String machineId) {
    }

    @Override
    public void complete(DeliveryType type, String targetId, String machineId) {
    }
}
