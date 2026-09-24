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
import org.springframework.stereotype.Component;

import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class DeliveryDispatcher {

    private final DeliverySpecRegistry registry;
    private final DeliveryRecorder recorder;

    public void dispatch(DeliverySeed seed) {
        DeliveryType type = seed.type();
        DeliverySpec<DeliverySeed, DeliveryPayload> spec = registry.require(type);
        DeliveryRequest<DeliveryPayload> request = spec.request(seed);
        DeliveryPayload payload = request.getPayload();
        String dispatchId = UUID.randomUUID().toString();
        String targetId = request.getTargetId();
        DeliveryRef delivery = new DeliveryRef(type, targetId, dispatchId);
        payload.setDelivery(delivery);
        recorder.record(request);
        String machineId = request.getMachineId();
        spec.publish(machineId, payload);
        log.info("Delivery dispatched: type={} targetId={} machineId={} dispatchId={}",
                type, request.getTargetId(), machineId, dispatchId);
    }
}
