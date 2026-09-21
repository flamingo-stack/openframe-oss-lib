package com.openframe.delivery;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryStatus;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.document.rmm.schedule.ScheduleOfflineBehavior;
import com.openframe.data.repository.delivery.MachineDeliveryRepository;
import com.openframe.delivery.DeliveryProperties.Policy;
import com.openframe.delivery.MachineOnlineStatus.Lookup;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Set;

import static java.util.stream.Collectors.toSet;

@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "openframe.delivery.enabled", havingValue = "true")
public class DeliverySweepService {

    private static final Sort OLDEST_DUE_FIRST = Sort.by("nextAttemptAt");

    private final MachineDeliveryRepository repository;
    private final MachineOnlineStatus machineOnlineStatus;
    private final DeliverySpecRegistry registry;
    private final DeliveryProperties properties;
    private final DeliveryFailureRecorder failureRecorder;
    private final DeliveryTracker tracker;
    private final DeliveryMetrics metrics;
    private final ObjectMapper objectMapper;

    public void retryPending() {
        Instant now = Instant.now();
        Set<DeliveryType> types = registry.types();
        types.forEach(type -> retryDue(type, now));
    }

    private void retryDue(DeliveryType type, Instant now) {
        Policy policy = properties.resolve(type);
        int batchSize = policy.getBatchSize();
        Pageable batch = PageRequest.of(0, batchSize, OLDEST_DUE_FIRST);
        List<MachineDelivery> due = repository.findByTypeAndStatusAndNextAttemptAtBefore(type, DeliveryStatus.PENDING, now, batch);
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
        } catch (RuntimeException e) {
            log.error("Delivery sweep failed for row: id={}", delivery.getId(), e);
        }
    }

    private void retryOrClose(MachineDelivery delivery, Lookup machines, Instant now) {
        String machineId = delivery.getMachineId();
        if (machines.isGone(machineId)) {
            cancel(delivery, "machine gone");
            return;
        }
        DeliverySpec<?, ?> spec = registry.require(delivery.getType());
        if (!spec.stillWanted(delivery)) {
            cancel(delivery, "no longer wanted");
            return;
        }
        Policy policy = properties.resolve(delivery);
        if (machines.isOffline(machineId)) {
            parkOrFailOffline(delivery, policy, now);
            return;
        }
        if (hasAttemptsLeft(delivery, policy)) {
            republish(spec, delivery, policy, now);
            return;
        }
        failureRecorder.fail(delivery, DeliveryFailure.EXHAUSTED, now);
    }

    private void cancel(MachineDelivery delivery, String reason) {
        tracker.cancel(delivery.getType(), delivery.getTargetId(), delivery.getMachineId());
        log.info("Delivery cancelled by sweep: id={} reason={}", delivery.getId(), reason);
    }

    private void parkOrFailOffline(MachineDelivery delivery, Policy policy, Instant now) {
        if (shouldSkipOffline(policy)) {
            failureRecorder.fail(delivery, DeliveryFailure.OFFLINE, now);
            return;
        }
        Instant windowEnd = reconnectWindowEnd(delivery, policy);
        if (now.isAfter(windowEnd)) {
            failureRecorder.fail(delivery, DeliveryFailure.OFFLINE, now);
            return;
        }
        repository.postpone(delivery.getId(), windowEnd);
        log.debug("Delivery parked until the machine comes online: id={} windowEnd={}", delivery.getId(), windowEnd);
    }

    private <S extends DeliverySeed, P> void republish(DeliverySpec<S, P> spec, MachineDelivery delivery, Policy policy, Instant now) {
        int attempt = delivery.getAttempts() + 1;
        long delaySeconds = retryDelaySeconds(attempt, policy);
        Instant nextAttemptAt = now.plusSeconds(delaySeconds);
        boolean stillPending = repository.markRepublished(delivery.getId(), now, nextAttemptAt);
        if (!stillPending) {
            log.debug("Delivery left PENDING before re-publish: id={}", delivery.getId());
            return;
        }
        Class<P> payloadClass = spec.getPayloadClass();
        P payload = readPayload(delivery, payloadClass);
        String machineId = delivery.getMachineId();
        spec.publish(machineId, payload);
        DeliveryType type = delivery.getType();
        metrics.recordRetried(type);
        log.info("Delivery re-published: type={} targetId={} machineId={} attempt={} nextAttemptAt={}",
                type, delivery.getTargetId(), machineId, attempt, nextAttemptAt);
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
        return policy.getOfflineBehavior() == ScheduleOfflineBehavior.SKIP;
    }

    private static Instant reconnectWindowEnd(MachineDelivery delivery, Policy policy) {
        long windowSeconds = policy.getReconnectWindowSeconds();
        return delivery.getDispatchedAt().plusSeconds(windowSeconds);
    }
}
