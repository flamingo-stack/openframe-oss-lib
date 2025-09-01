package com.openframe.kafka.producer;

import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.messaging.MessageDeliveryException;

@Slf4j
public class GenericKafkaProducer {

    private final KafkaTemplate<String, Object> kafkaTemplate;

    public GenericKafkaProducer(KafkaTemplate<String, Object> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    public <T> void sendMessage(String topic, T message) {
        try {
            kafkaTemplate.send(topic, message);
            log.info("Message sent to Kafka topic {}: {}", topic, message);
        } catch (Exception e) {
            log.error("Error sending message to Kafka topic {}: {}", topic, message, e);
            throw new MessageDeliveryException("Failed to send message to Kafka topic: %s, cause: %s".formatted(topic, e.getMessage()));
        }
    }

    public <T> void sendMessage(String topic, String key, T message) {
        try {
            kafkaTemplate.send(topic, key, message);
            log.info("Message sent to Kafka topic {} with key {}: {}", topic, key, message);
        } catch (Exception e) {
            log.error("Error sending message to Kafka topic {} with key {}: {}", topic, key, message, e);
            throw new MessageDeliveryException("Failed to send message to Kafka topic: %s, cause: %s".formatted(topic, e.getMessage()));
        }
    }
}

