package com.openframe.delivery.sweep;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryOfflineBehavior;
import com.openframe.data.document.delivery.DeliveryStatus;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.repository.delivery.MachineDeliveryRepository;
import com.openframe.delivery.config.DeliveryProperties;
import com.openframe.delivery.config.DeliveryProperties.Policy;
import com.openframe.delivery.metrics.DeliveryMetrics;
import com.openframe.delivery.spec.DeliverySeed;
import com.openframe.delivery.spec.DeliverySpec;
import com.openframe.delivery.spec.DeliverySpecRegistry;
import com.openframe.delivery.sweep.MachineOnlineStatus.Lookup;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Set;

import static java.util.stream.Collectors.toSet;

@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = {"openframe.delivery.enabled", "openframe.delivery.sweep.enabled"}, havingValue = "true")
public class DeliverySweepService {

    private final MachineDeliveryRepository repository;
    private final MachineOnlineStatus machineOnlineStatus;
    private final DeliverySpecRegistry registry;
    private final DeliveryProperties properties;
    private final DeliveryCloser closer;
    private final DeliveryMetrics metrics;
    private final ObjectMapper objectMapper;

    public void retryPending() {
        Instant now = Instant.now();
        int batchSize = properties.getSweep().getBatchSize();
        List<MachineDelivery> due = repository.findDue(DeliveryStatus.PENDING, now, batchSize);
        if (due.isEmpty()) {
            return;
        }
        Set<String> machineIds = due.stream().map(MachineDelivery::getMachineId).collect(toSet());
        Lookup machines = machineOnlineStatus.lookup(machineIds);
        due.forEach(delivery -> retryOne(delivery, machines, now));
    }

    private void retryOne(MachineDelivery delivery, Lookup machines, Instant now) {
        try {
            retryOrClose(delivery, machines, now);
        } catch (Exception e) {
            metrics.recordRowError();
            postponeAfterError(delivery, now);
            log.error("Delivery sweep failed for row, postponed: id={}", delivery.getId(), e);
        }
    }

    private void retryOrClose(MachineDelivery delivery, Lookup machines, Instant now) {
        String machineId = delivery.getMachineId();
        if (machines.isGone(machineId)) {
            closer.cancel(delivery, DeliveryStatus.UNACKED, "machine gone", now);
            return;
        }
        Policy policy = properties.resolve(delivery);
        if (machines.isOffline(machineId)) {
            parkSkipOrFailOffline(delivery, policy, now);
            return;
        }
        if (hasAttemptsLeft(delivery, policy)) {
            republish(delivery, policy, now);
            return;
        }
        closer.fail(delivery, DeliveryFailure.EXHAUSTED, DeliveryStatus.UNACKED, now);
    }

    private void parkSkipOrFailOffline(MachineDelivery delivery, Policy policy, Instant now) {
        if (shouldSkipOffline(policy)) {
            closer.cancel(delivery, DeliveryStatus.UNACKED, "machine not online, type skips offline machines", now);
            return;
        }
        Instant windowEnd = reconnectWindowEnd(delivery, policy);
        if (now.isAfter(windowEnd)) {
            closer.fail(delivery, DeliveryFailure.OFFLINE, DeliveryStatus.UNACKED, now);
            return;
        }
        repository.park(delivery.getId(), DeliveryStatus.UNACKED, windowEnd);
        log.debug("Delivery parked until the machine comes online: id={} windowEnd={}", delivery.getId(), windowEnd);
    }

    private void republish(MachineDelivery delivery, Policy policy, Instant now) {
        DeliveryType type = delivery.getType();
        DeliverySpec<DeliverySeed, Object> spec = registry.require(type);
        Class<Object> payloadClass = spec.getPayloadClass();
        Object payload = readPayload(delivery, payloadClass);
        String machineId = delivery.getMachineId();
        publish(spec, delivery, machineId, payload);

        int attempt = delivery.getAttempts() + 1;
        long delaySeconds = retryDelaySeconds(attempt, policy);
        Instant dueAt = now.plusSeconds(delaySeconds);
        Instant dispatchedAt = delivery.getDispatchedAt();
        boolean counted = repository.markRepublished(delivery.getId(), DeliveryStatus.UNACKED, dispatchedAt, now, dueAt);
        if (!counted) {
            log.debug("Delivery moved on while being re-published: id={}", delivery.getId());
            return;
        }
        metrics.recordRetried(type);
        log.info("Delivery re-published: type={} targetId={} machineId={} attempt={} dueAt={}",
                type, delivery.getTargetId(), machineId, attempt, dueAt);
    }

    private void publish(DeliverySpec<DeliverySeed, Object> spec, MachineDelivery delivery, String machineId, Object payload) {
        try {
            spec.publish(machineId, payload);
        } catch (RuntimeException e) {
            metrics.recordPublishFailed(delivery.getType());
            throw e;
        }
    }

    // a row that keeps failing must not be re-selected first every tick: back off without counting an attempt
    private void postponeAfterError(MachineDelivery delivery, Instant now) {
        Policy policy = properties.resolve(delivery);
        long delaySeconds = policy.getMaxRetryIntervalSeconds();
        Instant dueAt = now.plusSeconds(delaySeconds);
        repository.postpone(delivery.getId(), DeliveryStatus.UNACKED, dueAt);
    }

    private <P> P readPayload(MachineDelivery delivery, Class<P> payloadClass) {
        String payloadJson = delivery.getPayloadJson();
        try {
            return objectMapper.readValue(payloadJson, payloadClass);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Corrupt delivery payload: " + delivery.getId(), e);
        }
    }

    private static long retryDelaySeconds(int attempt, Policy policy) {
        int multiplier = policy.getBackoffMultiplier();
        long firstDelay = policy.getAckThresholdSeconds();
        double growth = Math.pow(multiplier, attempt);
        long delay = (long) (firstDelay * growth);
        long cap = policy.getMaxRetryIntervalSeconds();
        return Math.min(delay, cap);
    }

    private static boolean hasAttemptsLeft(MachineDelivery delivery, Policy policy) {
        return delivery.getAttempts() < policy.getMaxAttempts();
    }

    private static boolean shouldSkipOffline(Policy policy) {
        return policy.getOfflineBehavior() == DeliveryOfflineBehavior.SKIP;
    }

    private static Instant reconnectWindowEnd(MachineDelivery delivery, Policy policy) {
        long windowSeconds = policy.getReconnectWindowSeconds();
        return delivery.getDispatchedAt().plusSeconds(windowSeconds);
    }
}
