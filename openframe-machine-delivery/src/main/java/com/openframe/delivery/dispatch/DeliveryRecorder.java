package com.openframe.delivery.dispatch;

import com.openframe.data.document.delivery.DeliveryStatus;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.repository.delivery.MachineDeliveryRepository;
import com.openframe.data.repository.delivery.MachineDeliverySequenceRepository;
import com.openframe.delivery.config.DeliveryProperties;
import com.openframe.delivery.config.DeliveryProperties.Policy;
import com.openframe.delivery.spec.DeliveryPayload;
import com.openframe.delivery.spec.DeliveryRef;
import com.openframe.delivery.spec.DeliveryRequest;
import com.openframe.delivery.track.DeliveryId;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Instant;

@Slf4j
@Component
@RequiredArgsConstructor
public class DeliveryRecorder {

    private final MachineDeliveryRepository repository;
    private final MachineDeliverySequenceRepository sequences;
    private final DeliveryProperties properties;
    private final DeliveryPayloadJson payloadJson;

    // false = a row for this very dispatch already exists: the hand-off was replayed, nothing to do
    public boolean record(DeliveryRequest<?> request) {
        DeliveryType type = request.getType();
        String targetId = request.getTargetId();
        String machineId = request.getMachineId();
        String id = DeliveryId.of(type, targetId, machineId);
        DeliveryRef delivery = request.getPayload().getDelivery();
        String dispatchId = delivery.getDispatchId();
        if (repository.existsByIdAndDispatchId(id, dispatchId)) {
            return false;
        }
        // a rollout gives all its rows the sequence it started with: one decision, one number
        if (!hasSequence(delivery)) {
            int sequence = sequences.next();
            delivery.setSequence(sequence);
        }
        MachineDelivery row = pendingRow(request, id);
        repository.upsertPending(row);
        log.info("Delivery recorded: type={} targetId={} machineId={} sequence={}",
                type, targetId, machineId, delivery.getSequence());
        return true;
    }

    private static boolean hasSequence(DeliveryRef delivery) {
        return delivery.getSequence() != null;
    }

    private MachineDelivery pendingRow(DeliveryRequest<?> request, String id) {
        Instant now = Instant.now();
        DeliveryType type = request.getType();
        DeliveryPayload payload = request.getPayload();
        DeliveryRef delivery = payload.getDelivery();
        String dispatchId = delivery.getDispatchId();
        String json = payloadJson.write(payload);
        Policy policy = properties.resolve(type);
        long ackThresholdSeconds = policy.getAckThresholdSeconds();
        long ttlSeconds = policy.getTtlSeconds();
        return MachineDelivery.builder()
                .id(id)
                .type(type)
                .targetId(request.getTargetId())
                .machineId(request.getMachineId())
                .dispatchId(dispatchId)
                .status(DeliveryStatus.PENDING)
                .attempts(0)
                .errors(0)
                .payloadJson(json)
                .dispatchedAt(now)
                .dueAt(now.plusSeconds(ackThresholdSeconds))
                .expiresAt(now.plusSeconds(ttlSeconds))
                .build();
    }
}
