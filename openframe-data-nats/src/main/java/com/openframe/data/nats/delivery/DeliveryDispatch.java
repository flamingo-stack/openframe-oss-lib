package com.openframe.data.nats.delivery;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.document.rmm.delivery.DeliveryStatus;
import com.openframe.data.document.rmm.delivery.MachineDelivery;
import com.openframe.data.repository.rmm.MachineDeliveryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Instant;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "openframe.rmm.delivery.enabled", havingValue = "true")
public class DeliveryDispatch {

    private final MachineDeliveryRepository repository;
    private final ObjectMapper objectMapper;

    public void send(DeliveryRequest request, Runnable publish) {
        MachineDelivery delivery = pendingRow(request);
        repository.save(delivery);
        publish.run();
        log.info("Delivery dispatched: kind={} targetId={} machineId={}",
                request.getKind(), request.getTargetId(), request.getMachineId());
    }

    private MachineDelivery pendingRow(DeliveryRequest request) {
        Instant now = Instant.now();
        String id = MachineDelivery.id(request.getKind(), request.getTargetId(), request.getMachineId());
        String payloadJson = toJson(request.getPayload());
        return MachineDelivery.builder()
                .id(id)
                .kind(request.getKind())
                .targetId(request.getTargetId())
                .machineId(request.getMachineId())
                .status(DeliveryStatus.PENDING)
                .attempts(0)
                .payloadJson(payloadJson)
                .dispatchedAt(now)
                .lastAttemptAt(now)
                .offlineBehavior(request.getOfflineBehavior())
                .reconnectWindowSeconds(request.getReconnectWindowSeconds())
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
