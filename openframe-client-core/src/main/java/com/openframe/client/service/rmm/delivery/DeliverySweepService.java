package com.openframe.client.service.rmm.delivery;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.client.metrics.DeliveryMetrics;
import com.openframe.client.service.rmm.delivery.DeliveryProperties.Policy;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.delivery.DeliveryFailure;
import com.openframe.data.document.rmm.delivery.DeliveryKind;
import com.openframe.data.document.rmm.delivery.DeliveryStatus;
import com.openframe.data.document.rmm.delivery.MachineDelivery;
import com.openframe.data.document.rmm.schedule.ScheduleOfflineBehavior;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.MachineDeliveryRepository;
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
@ConditionalOnProperty(name = "openframe.rmm.delivery.enabled", havingValue = "true")
public class DeliverySweepService {

    private final MachineDeliveryRepository repository;
    private final MachineRepository machineRepository;
    private final DeliverySpecRegistry registry;
    private final DeliveryProperties properties;
    private final DeliveryFailureRecorder failureRecorder;
    private final DeliveryMetrics metrics;
    private final ObjectMapper objectMapper;

    public void retryPending() {
        Instant now = Instant.now();
        Set<DeliveryKind> kinds = registry.kinds();
        kinds.forEach(kind -> retryPending(kind, now));
    }

    private void retryPending(DeliveryKind kind, Instant now) {
        Policy policy = properties.resolve(kind);
        Instant threshold = now.minusSeconds(policy.getAckThresholdSeconds());
        List<MachineDelivery> unacked = repository.findByKindAndStatusAndLastAttemptAtBefore(kind, DeliveryStatus.PENDING, threshold);
        if (unacked.isEmpty()) {
            return;
        }
        Set<String> offlineMachineIds = offlineMachineIds(unacked);
        unacked.forEach(delivery -> retryOrFail(delivery, offlineMachineIds, now));
    }

    private Set<String> offlineMachineIds(List<MachineDelivery> deliveries) {
        Set<String> machineIds = deliveries.stream().map(MachineDelivery::getMachineId).collect(toSet());
        List<Machine> offline = machineRepository.findByMachineIdInAndStatus(machineIds, DeviceStatus.OFFLINE);
        return offline.stream().map(Machine::getMachineId).collect(toSet());
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
        log.debug("Delivery waits for machine to come online: kind={} targetId={} machineId={}",
                delivery.getKind(), delivery.getTargetId(), delivery.getMachineId());
    }

    private void republish(MachineDelivery delivery, Instant now) {
        DeliveryKind kind = delivery.getKind();
        DeliverySpec<?> spec = registry.require(kind);
        publish(spec, delivery);

        int attempt = delivery.getAttempts() + 1;
        delivery.setAttempts(attempt);
        delivery.setLastAttemptAt(now);
        repository.save(delivery);
        metrics.recordRetried(kind);
        log.info("Delivery re-published: kind={} targetId={} machineId={} attempt={}",
                kind, delivery.getTargetId(), delivery.getMachineId(), attempt);
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
