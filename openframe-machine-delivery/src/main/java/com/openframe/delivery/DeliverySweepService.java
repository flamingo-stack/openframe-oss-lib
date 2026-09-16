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
@ConditionalOnProperty(name = "openframe.delivery.enabled", havingValue = "true")
public class DeliverySweepService {

    private final MachineDeliveryRepository repository;
    private final MachineOnlineStatus machineOnlineStatus;
    private final DeliverySpecRegistry registry;
    private final DeliveryProperties properties;
    private final DeliveryFailureRecorder failureRecorder;
    private final DeliveryMetrics metrics;
    private final ObjectMapper objectMapper;

    public void retryPending() {
        Instant now = Instant.now();
        Set<DeliveryType> types = registry.types();
        types.forEach(type -> retryPending(type, now));
    }

    private void retryPending(DeliveryType type, Instant now) {
        Policy policy = properties.resolve(type);
        Instant threshold = now.minusSeconds(policy.getAckThresholdSeconds());
        List<MachineDelivery> unacked = repository.findByTypeAndStatusAndLastAttemptAtBefore(type, DeliveryStatus.PENDING, threshold);
        if (unacked.isEmpty()) {
            return;
        }
        Set<String> machineIds = unacked.stream().map(MachineDelivery::getMachineId).collect(toSet());
        Set<String> offlineMachineIds = machineOnlineStatus.offline(machineIds);
        unacked.forEach(delivery -> retryOrFail(delivery, offlineMachineIds, now));
    }

    private void retryOrFail(MachineDelivery delivery, Set<String> offlineMachineIds, Instant now) {
        Policy policy = properties.resolve(delivery);
        if (isOffline(delivery, offlineMachineIds)) {
            waitOrFailOffline(delivery, policy, now);
            return;
        }
        if (hasAttemptsLeft(delivery, policy)) {
            republish(delivery, now);
            return;
        }
        failureRecorder.fail(delivery, DeliveryFailure.EXHAUSTED, now);
    }

    private void waitOrFailOffline(MachineDelivery delivery, Policy policy, Instant now) {
        if (shouldSkipOffline(policy)) {
            failureRecorder.fail(delivery, DeliveryFailure.OFFLINE, now);
            return;
        }
        if (isReconnectWindowOver(delivery, policy, now)) {
            failureRecorder.fail(delivery, DeliveryFailure.OFFLINE, now);
            return;
        }
        log.debug("Delivery waits for machine to come online: type={} targetId={} machineId={}",
                delivery.getType(), delivery.getTargetId(), delivery.getMachineId());
    }

    private void republish(MachineDelivery delivery, Instant now) {
        DeliveryType type = delivery.getType();
        DeliverySpec<?> spec = registry.require(type);
        publish(spec, delivery);

        int attempt = delivery.getAttempts() + 1;
        delivery.setAttempts(attempt);
        delivery.setLastAttemptAt(now);
        repository.save(delivery);
        metrics.recordRetried(type);
        log.info("Delivery re-published: type={} targetId={} machineId={} attempt={}",
                type, delivery.getTargetId(), delivery.getMachineId(), attempt);
    }

    private <P> void publish(DeliverySpec<P> spec, MachineDelivery delivery) {
        Class<P> payloadClass = spec.getPayloadClass();
        P payload = readPayload(delivery, payloadClass);
        String machineId = delivery.getMachineId();
        spec.publish(machineId, payload);
    }

    private <P> P readPayload(MachineDelivery delivery, Class<P> payloadClass) {
        String payloadJson = delivery.getPayloadJson();
        try {
            return objectMapper.readValue(payloadJson, payloadClass);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Corrupt delivery payload: " + delivery.getId(), e);
        }
    }

    private static boolean isOffline(MachineDelivery delivery, Set<String> offlineMachineIds) {
        return offlineMachineIds.contains(delivery.getMachineId());
    }

    private static boolean hasAttemptsLeft(MachineDelivery delivery, Policy policy) {
        return delivery.getAttempts() < policy.getMaxAttempts();
    }

    private static boolean shouldSkipOffline(Policy policy) {
        return policy.getOfflineBehavior() == ScheduleOfflineBehavior.SKIP;
    }

    private static boolean isReconnectWindowOver(MachineDelivery delivery, Policy policy, Instant now) {
        Instant deadline = delivery.getDispatchedAt().plusSeconds(policy.getReconnectWindowSeconds());
        return now.isAfter(deadline);
    }
}
