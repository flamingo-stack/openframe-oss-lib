package com.openframe.client.listener.delivery;

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

import static org.springframework.util.StringUtils.hasText;

@Slf4j
@Component
@RequiredArgsConstructor
// without a topic the hand-off is off and the service behaves as before: nothing to consume, no placeholder to resolve
@ConditionalOnExpression("'${spring.oss-tenant.kafka.enabled:false}' == 'true' && '${openframe.delivery.dispatch-topic:}' != ''")
public class DeliveryDispatchListener {

    static final String REJECTED_INCOMPLETE = "incomplete";
    static final String REJECTED_MALFORMED = "malformed";
    private static final String DELIVERY_FIELD = "delivery";

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
        if (!isComplete(message)) {
            reject(REJECTED_INCOMPLETE, message, null);
            return;
        }
        try {
            dispatchLocally(message);
        } catch (IllegalArgumentException malformed) {
            reject(REJECTED_MALFORMED, message, malformed);
        }
    }

    private void dispatchLocally(DeliveryDispatchMessage message) {
        JsonNode command = message.getPayload();
        JsonNode deliveryNode = command.get(DELIVERY_FIELD);
        DeliveryRef delivery = objectMapper.convertValue(deliveryNode, DeliveryRef.class);
        if (!isComplete(delivery)) {
            reject(REJECTED_INCOMPLETE, message, null);
            return;
        }
        DeliveryType type = delivery.getType();
        DeliverySpec<DeliverySeed, DeliveryPayload> spec = registry.require(type);
        Class<DeliveryPayload> payloadClass = spec.getPayloadClass();
        DeliveryPayload payload = objectMapper.convertValue(command, payloadClass);
        DeliveryRequest<DeliveryPayload> request = DeliveryRequest.<DeliveryPayload>builder()
                .type(type)
                .targetId(delivery.getTargetId())
                .machineId(message.getMachineId())
                .payload(payload)
                .build();
        sink.accept(request);
    }

    private static boolean isComplete(DeliveryDispatchMessage message) {
        JsonNode command = message.getPayload();
        return hasText(message.getMachineId()) && command != null && command.has(DELIVERY_FIELD);
    }

    private static boolean isComplete(DeliveryRef delivery) {
        return delivery.getType() != null && hasText(delivery.getTargetId()) && hasText(delivery.getDispatchId());
    }

    private void reject(String reason, DeliveryDispatchMessage message, Exception cause) {
        metrics.recordDispatchRejected(reason);
        log.error("Delivery hand-off rejected, {}: {}", reason, message, cause);
    }
}
