package com.openframe.client.service.delivery;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.delivery.dispatch.DeliveryPublisher;
import com.openframe.delivery.dispatch.DeliveryRecorder;
import com.openframe.delivery.dispatch.DeliverySink;
import com.openframe.delivery.metrics.DeliveryMetrics;
import com.openframe.delivery.spec.DeliveryPayload;
import com.openframe.delivery.spec.DeliveryRequest;
import com.openframe.delivery.spec.DeliverySeed;
import com.openframe.delivery.spec.DeliverySpec;
import com.openframe.delivery.spec.DeliverySpecRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

// client-service is the only service that writes delivery rows and talks to the agent over NATS
@Slf4j
@Component
@RequiredArgsConstructor
public class LocalDeliverySink implements DeliverySink {

    public static final String SINK = "local";

    private final DeliverySpecRegistry registry;
    private final DeliveryRecorder recorder;
    private final DeliveryPublisher publisher;
    private final DeliveryMetrics metrics;

    @Override
    public void accept(DeliveryRequest<?> request) {
        DeliveryType type = request.getType();
        String machineId = request.getMachineId();
        boolean recorded = recorder.record(request);
        if (!recorded) {
            metrics.recordDispatchDuplicate(type);
            log.info("Delivery already recorded, hand-off repeated: type={} targetId={} machineId={}",
                    type, request.getTargetId(), machineId);
            return;
        }
        DeliverySpec<DeliverySeed, DeliveryPayload> spec = registry.require(type);
        String subject = spec.subject(machineId);
        DeliveryPayload payload = request.getPayload();
        publisher.publish(subject, payload);
        metrics.recordDispatched(type, SINK);
        log.info("Delivery dispatched: type={} targetId={} machineId={} dispatchId={}",
                type, request.getTargetId(), machineId, payload.getDelivery().getDispatchId());
    }
}
