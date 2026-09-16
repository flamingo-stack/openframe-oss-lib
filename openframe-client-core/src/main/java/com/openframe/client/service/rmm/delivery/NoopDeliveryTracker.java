package com.openframe.client.service.rmm.delivery;

import com.openframe.data.document.rmm.delivery.DeliveryKind;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "openframe.rmm.delivery.enabled", havingValue = "false", matchIfMissing = true)
public class NoopDeliveryTracker implements DeliveryTracker {

    @Override
    public void acknowledge(DeliveryKind kind, String targetId, String machineId) {
    }

    @Override
    public void complete(DeliveryKind kind, String targetId, String machineId) {
    }
}
