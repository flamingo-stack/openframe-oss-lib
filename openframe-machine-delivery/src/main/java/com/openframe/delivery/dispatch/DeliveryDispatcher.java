package com.openframe.delivery.dispatch;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.delivery.spec.DeliveryPayload;
import com.openframe.delivery.spec.DeliveryRef;
import com.openframe.delivery.spec.DeliveryRequest;
import com.openframe.delivery.spec.DeliverySeed;
import com.openframe.delivery.spec.DeliverySpec;
import com.openframe.delivery.spec.DeliverySpecRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class DeliveryDispatcher {

    private final DeliverySpecRegistry registry;
    // ObjectProvider: the dispatcher boots in services with neither NATS nor Kafka, where no sink bean exists
    private final ObjectProvider<DeliverySink> sink;

    public void dispatch(DeliverySeed seed) {
        DeliveryType type = seed.getType();
        DeliverySpec<DeliverySeed, DeliveryPayload> spec = registry.require(type);
        DeliveryRequest<DeliveryPayload> request = spec.request(seed);
        DeliveryPayload payload = request.getPayload();
        String dispatchId = UUID.randomUUID().toString();
        String targetId = request.getTargetId();
        DeliveryRef delivery = new DeliveryRef(type, targetId, dispatchId);
        payload.setDelivery(delivery);
        sink.getObject().accept(request);
    }
}
