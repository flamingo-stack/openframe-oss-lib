package com.openframe.client.service.delivery;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.delivery.dispatch.DeliveryPublisher;
import com.openframe.delivery.dispatch.DeliveryRecordOutcome;
import com.openframe.delivery.dispatch.DeliveryRecorder;
import com.openframe.delivery.dispatch.DeliverySink;
import com.openframe.delivery.metrics.DeliveryMetrics;
import com.openframe.delivery.rollout.DeliveryRolloutRecorder;
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
    static final String REJECTED_OUTRANKED = "outranked";

    private final DeliverySpecRegistry registry;
    private final DeliveryRecorder recorder;
    private final DeliveryRolloutRecorder rollouts;
    private final DeliveryPublisher publisher;
    private final DeliveryMetrics metrics;

    @Override
    public void accept(DeliveryRequest<?> request) {
        if (request.isForEveryMachine()) {
            rollouts.record(request);
        } else {
            dispatchToMachine(request);
        }
    }

    private void dispatchToMachine(DeliveryRequest<?> request) {
        DeliveryRecordOutcome outcome = recorder.record(request);
        if (outcome == DeliveryRecordOutcome.RECORDED) {
            publish(request);
        } else {
            skip(request, outcome);
        }
    }

    // replayed = the hand-off was repeated; outranked = a newer dispatch of the same key holds the row
    private void skip(DeliveryRequest<?> request, DeliveryRecordOutcome outcome) {
        DeliveryType type = request.getType();
        if (outcome == DeliveryRecordOutcome.REPLAYED) {
            metrics.recordDispatchDuplicate(type);
        } else {
            metrics.recordDispatchRejected(REJECTED_OUTRANKED);
        }
        log.info("Delivery not published, {}: type={} targetId={} machineId={}",
                outcome, type, request.getTargetId(), request.getMachineId());
    }

    // the row is the source of truth: a publish that fails here is retried by the sweep, never by the caller or Kafka
    private void publish(DeliveryRequest<?> request) {
        DeliveryType type = request.getType();
        String machineId = request.getMachineId();
        DeliverySpec<DeliverySeed, DeliveryPayload> spec = registry.require(type);
        String subject = spec.subject(machineId);
        DeliveryPayload payload = request.getPayload();
        try {
            publisher.publish(subject, payload);
        } catch (RuntimeException natsDown) {
            metrics.recordPublishFailed(type);
            log.warn("Delivery recorded but not published, left to the sweep: type={} targetId={} machineId={}",
                    type, request.getTargetId(), machineId, natsDown);
            return;
        }
        metrics.recordDispatched(type, SINK);
        log.info("Delivery dispatched: type={} targetId={} machineId={} dispatchId={}",
                type, request.getTargetId(), machineId, payload.getDelivery().getDispatchId());
    }
}
