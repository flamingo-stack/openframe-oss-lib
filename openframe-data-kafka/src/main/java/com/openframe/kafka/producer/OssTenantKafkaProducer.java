package com.openframe.kafka.producer;

import org.springframework.kafka.core.KafkaTemplate;

public class OssTenantKafkaProducer extends GenericKafkaProducer implements OssTenantMessageProducer {

    public OssTenantKafkaProducer(KafkaTemplate<String, Object> ossKafkaTemplate) {
        super(ossKafkaTemplate);
    }

    @Override
    public <T> void sendMessage(String topic, T message, String key) {
        sendMessage(topic, key, message);
    }
}
