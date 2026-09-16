package com.openframe.delivery;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.document.delivery.DeliveryStatus;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.repository.delivery.MachineDeliveryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Instant;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "openframe.delivery.enabled", havingValue = "true")
public class RecordingDeliveryDispatch implements DeliveryDispatch {

    private final MachineDeliveryRepository repository;
    private final ObjectMapper objectMapper;

    @Override
    public void send(DeliveryRequest<?> request) {
        MachineDelivery delivery = pendingRow(request);
        repository.save(delivery);
        publish(request);
        log.info("Delivery dispatched: type={} targetId={} machineId={}",
                request.getType(), request.getTargetId(), request.getMachineId());
    }

    private <P> void publish(DeliveryRequest<P> request) {
        DeliverySpec<P> spec = request.getSpec();
        spec.publish(request.getMachineId(), request.getPayload());
    }

    private MachineDelivery pendingRow(DeliveryRequest<?> request) {
        Instant now = Instant.now();
        String id = MachineDelivery.id(request.getType(), request.getTargetId(), request.getMachineId());
        String payloadJson = toJson(request.getPayload());
        return MachineDelivery.builder()
                .id(id)
                .type(request.getType())
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
