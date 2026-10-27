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
    public void accept(DeliveryRequest<? extends DeliveryPayload> request) {
        if (isRollout(request)) {
            rollouts.record(request);
        } else {
            dispatchToMachine(request);
        }
    }

    // every machine, of a type that may be rolled out; anything else goes the ordinary way and fails there if it must
    private boolean isRollout(DeliveryRequest<? extends DeliveryPayload> request) {
        if (!request.isForEveryMachine()) {
            return false;
        }
        DeliverySpec<DeliverySeed, DeliveryPayload> spec = registry.require(request.getType());
        return spec.canDeliverToEveryMachine();
    }

    private void dispatchToMachine(DeliveryRequest<? extends DeliveryPayload> request) {
        DeliveryRecordOutcome outcome = recorder.record(request);
        switch (outcome) {
            case RECORDED -> publish(request);
            case HELD -> hold(request);
            case SCHEDULED -> defer(request);
            default -> skip(request, outcome);
        }
    }

    private void defer(DeliveryRequest<? extends DeliveryPayload> request) {
        DeliveryType type = request.getType();
        metrics.recordDispatchScheduled(type);
        log.info("Delivery scheduled, the sweep publishes it once due: type={} targetId={} machineId={} notBefore={}",
                type, request.getTargetId(), request.getMachineId(), request.getNotBefore());
    }

    private void hold(DeliveryRequest<? extends DeliveryPayload> request) {
        DeliveryType type = request.getType();
        metrics.recordDispatchHeld(type);
        log.info("Delivery held until the machine is online, the sweep publishes it: type={} targetId={} machineId={}",
                type, request.getTargetId(), request.getMachineId());
    }

    // replayed = the hand-off was repeated; outranked = a newer dispatch of the same key holds the row
    private void skip(DeliveryRequest<? extends DeliveryPayload> request, DeliveryRecordOutcome outcome) {
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
    private void publish(DeliveryRequest<? extends DeliveryPayload> request) {
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
