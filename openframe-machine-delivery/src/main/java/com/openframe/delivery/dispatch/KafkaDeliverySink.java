package com.openframe.delivery.dispatch;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.delivery.metrics.DeliveryMetrics;
import com.openframe.delivery.spec.DeliveryAudience;
import com.openframe.delivery.spec.DeliveryPayload;
import com.openframe.delivery.spec.DeliveryRequest;
import com.openframe.kafka.producer.OssTenantKafkaProducer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RequiredArgsConstructor
public class KafkaDeliverySink implements DeliverySink {

    public static final String SINK = "kafka";

    private final OssTenantKafkaProducer producer;
    private final ObjectMapper objectMapper;
    private final DeliveryMetrics metrics;
    private final String topic;

    @Override
    public void accept(DeliveryRequest<? extends DeliveryPayload> request) {
        DeliveryType type = request.getType();
        DeliveryAudience audience = request.getAudience();
        String machineId = request.getMachineId();
        DeliveryPayload payload = request.getPayload();
        JsonNode command = objectMapper.valueToTree(payload);
        DeliveryDispatchMessage message = new DeliveryDispatchMessage(audience, machineId, command, request.getDueAt());
        try {
            producer.sendAndAwait(topic, keyOf(request), message);
        } catch (RuntimeException kafkaDown) {
            metrics.recordDispatchFailed(type);
            throw kafkaDown;
        }
        metrics.recordDispatched(type, SINK);
        log.info("Delivery handed to Kafka: type={} targetId={} audience={} machineId={}", type, request.getTargetId(), audience, machineId);
    }

    // the key keeps one machine's hand-offs in order; a rollout has no machine, its target does the same job
    private static String keyOf(DeliveryRequest<? extends DeliveryPayload> request) {
        return request.isForEveryMachine() ? request.getTargetId() : request.getMachineId();
    }
}
