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
import java.util.Optional;

@Slf4j
@Component
@RequiredArgsConstructor
public class DeliveryRecorder {

    private final MachineDeliveryRepository repository;
    private final MachineDeliverySequenceRepository sequences;
    private final DeliveryProperties properties;
    private final DeliveryPayloadJson payloadJson;

    public DeliveryRecordOutcome record(DeliveryRequest<?> request) {
        DeliveryType type = request.getType();
        String targetId = request.getTargetId();
        String machineId = request.getMachineId();
        String id = DeliveryId.of(type, targetId, machineId);
        DeliveryRef delivery = request.getPayload().getDelivery();
        String dispatchId = delivery.getDispatchId();
        if (repository.existsByIdAndDispatchId(id, dispatchId)) {
            return DeliveryRecordOutcome.REPLAYED;
        }
        int sequence = sequenceOf(delivery);
        delivery.setSequence(sequence);
        MachineDelivery row = pendingRow(request, id);
        boolean taken = repository.upsertPending(row);
        if (!taken) {
            log.info("Delivery outranked, a newer dispatch holds the row: type={} targetId={} machineId={} sequence={}",
                    type, targetId, machineId, sequence);
            return DeliveryRecordOutcome.OUTRANKED;
        }
        log.info("Delivery recorded: type={} targetId={} machineId={} sequence={}", type, targetId, machineId, sequence);
        return DeliveryRecordOutcome.RECORDED;
    }

    // a rollout gives all its rows the sequence it started with; a single dispatch takes the next one
    private int sequenceOf(DeliveryRef delivery) {
        return Optional.ofNullable(delivery.getSequence()).orElseGet(sequences::next);
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
                .sequence(delivery.getSequence())
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
