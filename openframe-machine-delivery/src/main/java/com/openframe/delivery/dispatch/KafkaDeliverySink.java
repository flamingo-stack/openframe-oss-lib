package com.openframe.delivery.dispatch;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.delivery.metrics.DeliveryMetrics;
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
    public void accept(DeliveryRequest<?> request) {
        DeliveryType type = request.getType();
        String machineId = request.getMachineId();
        DeliveryPayload payload = request.getPayload();
        JsonNode command = objectMapper.valueToTree(payload);
        DeliveryDispatchMessage message = new DeliveryDispatchMessage(machineId, command);
        try {
            producer.sendAndAwait(topic, machineId, message);
        } catch (RuntimeException kafkaDown) {
            metrics.recordDispatchFailed(type);
            throw kafkaDown;
        }
        metrics.recordDispatched(type, SINK);
        log.info("Delivery handed to Kafka: type={} targetId={} machineId={}", type, request.getTargetId(), machineId);
    }
}
