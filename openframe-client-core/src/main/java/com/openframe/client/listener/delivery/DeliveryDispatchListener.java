package com.openframe.client.listener.delivery;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.client.service.delivery.LocalDeliverySink;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.delivery.dispatch.DeliveryDispatchMessage;
import com.openframe.delivery.metrics.DeliveryMetrics;
import com.openframe.delivery.spec.DeliveryPayload;
import com.openframe.delivery.spec.DeliveryRef;
import com.openframe.delivery.spec.DeliveryRequest;
import com.openframe.delivery.spec.DeliverySeed;
import com.openframe.delivery.spec.DeliverySpec;
import com.openframe.delivery.spec.DeliverySpecRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
// without a topic the hand-off is off and the service behaves as before: nothing to consume, no placeholder to resolve
@ConditionalOnExpression("'${spring.oss-tenant.kafka.enabled:false}' == 'true' && '${openframe.delivery.dispatch-topic:}' != ''")
public class DeliveryDispatchListener {

    static final String REJECTED_INCOMPLETE = "incomplete";
    static final String REJECTED_MALFORMED = "malformed";

    private final DeliverySpecRegistry registry;
    private final LocalDeliverySink sink;
    private final ObjectMapper objectMapper;
    private final DeliveryMetrics metrics;

    // a bad message is logged and skipped; anything else (Mongo, NATS) propagates so the container retries the record
    @KafkaListener(
            topics = "${openframe.delivery.dispatch-topic}",
            groupId = "client-service-delivery-dispatch",
            containerFactory = "ossTenantKafkaListenerContainerFactory")
    public void onDispatch(DeliveryDispatchMessage message) {
        DeliveryRequest<DeliveryPayload> request;
        try {
            request = toRequest(message);
        } catch (JsonProcessingException | IllegalArgumentException permanentlyBad) {
            metrics.recordDispatchRejected(REJECTED_MALFORMED);
            log.error("Delivery hand-off rejected, malformed: {}", message, permanentlyBad);
            return;
        }
        if (request == null) {
            metrics.recordDispatchRejected(REJECTED_INCOMPLETE);
            log.error("Delivery hand-off rejected, delivery block incomplete: {}", message);
            return;
        }
        sink.accept(request);
    }

    private DeliveryRequest<DeliveryPayload> toRequest(DeliveryDispatchMessage message) throws JsonProcessingException {
        JsonNode payloadNode = message.getPayload();
        String machineId = message.getMachineId();
        if (payloadNode == null || machineId == null || machineId.isBlank()) {
            return null;
        }
        JsonNode deliveryNode = payloadNode.get("delivery");
        if (deliveryNode == null) {
            return null;
        }
        DeliveryRef delivery = objectMapper.treeToValue(deliveryNode, DeliveryRef.class);
        DeliveryType type = delivery.getType();
        String targetId = delivery.getTargetId();
        if (type == null || targetId == null || delivery.getDispatchId() == null) {
            return null;
        }
        DeliverySpec<DeliverySeed, DeliveryPayload> spec = registry.require(type);
        Class<DeliveryPayload> payloadClass = spec.getPayloadClass();
        DeliveryPayload payload = objectMapper.treeToValue(payloadNode, payloadClass);
        return DeliveryRequest.<DeliveryPayload>builder()
                .type(type)
                .targetId(targetId)
                .machineId(machineId)
                .payload(payload)
                .build();
    }
}
