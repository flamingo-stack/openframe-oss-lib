package com.openframe.delivery.dispatch;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.delivery.metrics.DeliveryMetrics;
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
        JsonNode payload = objectMapper.valueToTree(request.getPayload());
        DeliveryDispatchMessage message = new DeliveryDispatchMessage(machineId, payload);
        try {
            producer.sendAndAwait(topic, machineId, message);
        } catch (RuntimeException e) {
            metrics.recordDispatchFailed(type);
            log.error("Delivery hand-off to Kafka failed: type={} targetId={} machineId={} topic={}",
                    type, request.getTargetId(), machineId, topic, e);
            throw e;
        }
        metrics.recordDispatched(type, SINK);
        log.info("Delivery handed to Kafka: type={} targetId={} machineId={}", type, request.getTargetId(), machineId);
    }
}
