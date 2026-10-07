package com.openframe.delivery.track;

import com.openframe.data.document.delivery.DeliveryStatus;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.repository.delivery.MachineDeliveryRepository;
import com.openframe.delivery.config.DeliveryProperties;
import com.openframe.delivery.config.DeliveryProperties.Policy;
import com.openframe.delivery.spec.DeliveryRef;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Slf4j
@Service
@RequiredArgsConstructor
public class DeliveryTracker {

    private final MachineDeliveryRepository repository;
    private final DeliveryProperties properties;
    private final DeliveryCloser closer;

    // ref = the delivery block the agent copied back from the command; the row is looked up by that exact dispatch
    public void acknowledge(DeliveryRef ref, String machineId) {
        DeliveryType type = ref.getType();
        String targetId = ref.getTargetId();
        String dispatchId = ref.getDispatchId();
        String id = DeliveryId.of(type, targetId, machineId);
        Instant now = Instant.now();
        Policy policy = properties.resolve(type);
        long resultTimeoutSeconds = policy.getResultTimeoutSeconds();
        Instant resultDueAt = now.plusSeconds(resultTimeoutSeconds);
        boolean acked = repository.markAcked(id, dispatchId, DeliveryStatus.UNACKED, now, resultDueAt) > 0;
        if (acked) {
            log.info("Delivery ACKED: type={} targetId={} machineId={} dispatchId={}", type, targetId, machineId, dispatchId);
        } else {
            log.debug("Delivery ack ignored, no unacked row for this dispatch: id={} dispatchId={}", id, dispatchId);
        }
    }

    public void done(DeliveryRef ref, String machineId) {
        DeliveryType type = ref.getType();
        String targetId = ref.getTargetId();
        String dispatchId = ref.getDispatchId();
        String id = DeliveryId.of(type, targetId, machineId);
        Instant now = Instant.now();
        Instant expiresAt = expiresAt(type, now);
        boolean done = repository.markDone(id, dispatchId, DeliveryStatus.COMPLETABLE, now, expiresAt) > 0;
        if (done) {
            log.info("Delivery DONE: type={} targetId={} machineId={} dispatchId={}", type, targetId, machineId, dispatchId);
        } else {
            log.debug("Delivery completion ignored, no row for this dispatch: id={} dispatchId={}", id, dispatchId);
        }
    }

    public void fail(DeliveryRef ref, String machineId, String error) {
        Instant now = Instant.now();
        closer.failReported(ref.getType(), ref.getTargetId(), machineId, ref.getDispatchId(), error, now);
    }

    private Instant expiresAt(DeliveryType type, Instant now) {
        Policy policy = properties.resolve(type);
        long ttlSeconds = policy.getTtlSeconds();
        return now.plusSeconds(ttlSeconds);
    }
}
