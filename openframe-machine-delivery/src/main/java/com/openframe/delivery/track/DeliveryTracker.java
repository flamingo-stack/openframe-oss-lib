package com.openframe.delivery.track;

import com.openframe.data.document.delivery.DeliveryStatus;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.repository.delivery.MachineDeliveryRepository;
import com.openframe.delivery.config.DeliveryProperties;
import com.openframe.delivery.config.DeliveryProperties.Policy;
import com.openframe.delivery.spec.DeliveryPayload;
import com.openframe.delivery.spec.DeliveryRef;
import com.openframe.delivery.spec.DeliverySeed;
import com.openframe.delivery.spec.DeliverySpec;
import com.openframe.delivery.spec.DeliverySpecRegistry;
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
    private final DeliverySpecRegistry registry;

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
            repository.findById(id).ifPresent(this::notifyAcked);
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
        boolean done = repository.markDone(id, dispatchId, DeliveryStatus.COMPLETABLE, now, expiresAt);
        if (done) {
            log.info("Delivery DONE: type={} targetId={} machineId={} dispatchId={}", type, targetId, machineId, dispatchId);
        } else {
            log.debug("Delivery completion ignored, no row for this dispatch: id={} dispatchId={}", id, dispatchId);
        }
    }

    // seed = what we asked for; used when the server learns the outcome outside the result channel, e.g. the agent's own uninstall call
    public void done(DeliverySeed seed) {
        DeliveryType type = seed.getType();
        String targetId = seed.getTargetId();
        String machineId = seed.getMachineId();
        String id = DeliveryId.of(type, targetId, machineId);
        Instant now = Instant.now();
        Instant expiresAt = expiresAt(type, now);
        boolean done = repository.markDone(id, DeliveryStatus.COMPLETABLE, now, expiresAt);
        if (done) {
            log.info("Delivery DONE: type={} targetId={} machineId={}", type, targetId, machineId);
        } else {
            log.debug("Delivery completion ignored, no completable row: id={}", id);
        }
    }

    public void fail(DeliveryRef ref, String machineId, String error) {
        Instant now = Instant.now();
        closer.failReported(ref.getType(), ref.getTargetId(), machineId, ref.getDispatchId(), error, now);
    }

    private void notifyAcked(MachineDelivery delivery) {
        DeliveryType type = delivery.getType();
        Optional<DeliverySpec<DeliverySeed, DeliveryPayload>> spec = registry.find(type);
        spec.ifPresent(registered -> registered.onAcked(delivery));
    }

    private Instant expiresAt(DeliveryType type, Instant now) {
        Policy policy = properties.resolve(type);
        long ttlSeconds = policy.getTtlSeconds();
        return now.plusSeconds(ttlSeconds);
    }
}
