package com.openframe.delivery.track;

import com.openframe.data.document.delivery.DeliveryStatus;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.repository.delivery.MachineDeliveryRepository;
import com.openframe.delivery.config.DeliveryProperties;
import com.openframe.delivery.config.DeliveryProperties.Policy;
import com.openframe.delivery.spec.DeliveryRef;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Optional;

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
        boolean acked = repository.markAcked(id, dispatchId, DeliveryStatus.UNACKED, now, resultDueAt);
        if (acked) {
            log.info("Delivery ACKED: type={} targetId={} machineId={} dispatchId={}", type, targetId, machineId, dispatchId);
        } else {
            log.debug("Delivery ack ignored, no unacked row for this dispatch: id={} dispatchId={}", id, dispatchId);
        }
    }

    // for a receiver that reports by key rather than by the delivery block: one request is one dispatch there
    public void acknowledge(DeliveryType type, String targetId, String machineId) {
        Optional<DeliveryRef> current = currentRef(type, targetId, machineId);
        current.ifPresent(ref -> acknowledge(ref, machineId));
    }

    public void done(DeliveryRef ref, String machineId) {
        DeliveryType type = ref.getType();
        String targetId = ref.getTargetId();
        String dispatchId = ref.getDispatchId();
        String id = DeliveryId.of(type, targetId, machineId);
        Instant now = Instant.now();
        Instant expiresAt = expiresAt(type, now);
        boolean done = repository.markDone(id, dispatchId, DeliveryStatus.COMPLETABLE, now, expiresAt);
        if (done) {
            log.info("Delivery DONE: type={} targetId={} machineId={} dispatchId={}", type, targetId, machineId, dispatchId);
        } else {
            log.debug("Delivery completion ignored, no row for this dispatch: id={} dispatchId={}", id, dispatchId);
        }
    }

    public void done(DeliveryType type, String targetId, String machineId) {
        Optional<DeliveryRef> current = currentRef(type, targetId, machineId);
        current.ifPresent(ref -> done(ref, machineId));
    }

    public void fail(DeliveryRef ref, String machineId, String error) {
        Instant now = Instant.now();
        closer.failReported(ref.getType(), ref.getTargetId(), machineId, ref.getDispatchId(), error, now);
    }

    // the caller withdrew the request: an open row stops being re-published; the machine is told by the caller
    public void cancel(DeliveryType type, String targetId, String machineId, String reason) {
        Instant now = Instant.now();
        Optional<MachineDelivery> current = currentRow(type, targetId, machineId);
        current.ifPresent(row -> closer.cancel(row, DeliveryStatus.OPEN, reason, now));
    }

    private Optional<DeliveryRef> currentRef(DeliveryType type, String targetId, String machineId) {
        return currentRow(type, targetId, machineId)
                .map(MachineDelivery::getDispatchId)
                .map(dispatchId -> new DeliveryRef(type, targetId, dispatchId));
    }

    private Optional<MachineDelivery> currentRow(DeliveryType type, String targetId, String machineId) {
        String id = DeliveryId.of(type, targetId, machineId);
        return repository.findByIdOnPrimary(id);
    }

    private Instant expiresAt(DeliveryType type, Instant now) {
        Policy policy = properties.resolve(type);
        long ttlSeconds = policy.getTtlSeconds();
        return now.plusSeconds(ttlSeconds);
    }
}
