package com.openframe.delivery.dispatch;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.document.delivery.DeliveryStatus;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.repository.delivery.MachineDeliveryRepository;
import com.openframe.delivery.config.DeliveryProperties;
import com.openframe.delivery.config.DeliveryProperties.Policy;
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
    private final DeliveryProperties properties;
    private final ObjectMapper objectMapper;

    public void record(DeliveryRequest<?> request) {
        if (!properties.isEnabled()) {
            return;
        }
        MachineDelivery delivery = pendingRow(request);
        repository.upsertPending(delivery);
        log.info("Delivery recorded: type={} targetId={} machineId={}",
                request.getType(), request.getTargetId(), request.getMachineId());
    }

    private MachineDelivery pendingRow(DeliveryRequest<?> request) {
        Instant now = Instant.now();
        DeliveryType type = request.getType();
        String targetId = request.getTargetId();
        String machineId = request.getMachineId();
        String id = DeliveryId.of(type, targetId, machineId);
        Object payload = request.getPayload();
        String payloadJson = toJson(payload);
        Policy policy = properties.resolve(type);
        long ackThresholdSeconds = policy.getAckThresholdSeconds();
        long ttlSeconds = policy.getTtlSeconds();
        return MachineDelivery.builder()
                .id(id)
                .type(type)
                .targetId(targetId)
                .machineId(machineId)
                .status(DeliveryStatus.PENDING)
                .attempts(0)
                .errors(0)
                .payloadJson(payloadJson)
                .dispatchedAt(now)
                .dueAt(now.plusSeconds(ackThresholdSeconds))
                .expiresAt(now.plusSeconds(ttlSeconds))
                .build();
    }

    private String toJson(Object payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            String payloadType = payload.getClass().getSimpleName();
            throw new IllegalArgumentException("Delivery payload is not serializable: " + payloadType, e);
        }
    }
}
