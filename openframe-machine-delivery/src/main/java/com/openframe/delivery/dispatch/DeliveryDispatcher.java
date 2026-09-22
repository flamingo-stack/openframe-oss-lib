package com.openframe.delivery.dispatch;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.delivery.spec.DeliveryRequest;
import com.openframe.delivery.spec.DeliverySeed;
import com.openframe.delivery.spec.DeliverySpec;
import com.openframe.delivery.spec.DeliverySpecRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class DeliveryDispatcher {

    private final DeliverySpecRegistry registry;
    private final DeliveryRecorder recorder;

    public void dispatch(DeliverySeed seed) {
        DeliveryType type = seed.type();
        DeliverySpec<DeliverySeed, Object> spec = registry.require(type);
        DeliveryRequest<Object> request = spec.request(seed);
        recorder.record(request);
        String machineId = request.getMachineId();
        Object payload = request.getPayload();
        spec.publish(machineId, payload);
        log.info("Delivery dispatched: type={} targetId={} machineId={}", type, request.getTargetId(), machineId);
    }
}
