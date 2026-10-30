package com.openframe.delivery.dispatch;

import com.openframe.data.document.delivery.DeliveryStatus;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.repository.delivery.MachineDeliveryRepository;
import com.openframe.data.repository.delivery.PayloadReplacement;
import com.openframe.delivery.spec.DeliveryPayload;
import com.openframe.delivery.track.DeliveryId;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static com.openframe.delivery.dispatch.DeliveryRecorder.BODY_OUTLIVES_ROW_SECONDS;

// the caller changed its mind about the content of a command the agent has not received yet: the row keeps its place
// and its attempts, takes the new body under a new dispatch and goes out on the next sweep pass. A row the agent
// already took stays as it is, the caller decides what to do about that
@Slf4j
@Component
@RequiredArgsConstructor
public class DeliveryRefresher {

    private final MachineDeliveryRepository repository;
    private final DeliveryPayloadStore payloads;
    private final DeliveryPayloadJson payloadJson;

    public boolean refresh(DeliveryType type, String targetId, String machineId, DeliveryPayload payload) {
        String id = DeliveryId.of(type, targetId, machineId);
        Optional<MachineDelivery> unacked = repository.findByIdOnPrimary(id).filter(DeliveryRefresher::isUnacked);
        if (unacked.isEmpty()) {
            log.debug("Delivery body kept, no unacked row: id={}", id);
            return false;
        }
        MachineDelivery row = unacked.get();
        DeliveryPayloadBody body = payloadJson.body(payload);
        Instant bodyExpiresAt = row.getExpiresAt().plusSeconds(BODY_OUTLIVES_ROW_SECONDS);
        String payloadId = payloads.hold(type, body, bodyExpiresAt);
        String nextDispatchId = UUID.randomUUID().toString();
        PayloadReplacement replacement = PayloadReplacement.builder()
                .id(id)
                .from(DeliveryStatus.UNACKED)
                .dispatchId(row.getDispatchId())
                .payloadId(payloadId)
                .nextDispatchId(nextDispatchId)
                .dueAt(Instant.now())
                .build();
        boolean replaced = repository.replacePayload(replacement);
        if (replaced) {
            log.info("Delivery body replaced: type={} targetId={} machineId={} dispatchId={}", type, targetId, machineId, nextDispatchId);
        } else {
            log.debug("Delivery body kept, the row moved meanwhile: id={}", id);
        }
        return replaced;
    }

    private static boolean isUnacked(MachineDelivery row) {
        return DeliveryStatus.UNACKED.contains(row.getStatus());
    }
}
