package com.openframe.kafka.producer;

import org.springframework.kafka.core.KafkaTemplate;

public class SaasKafkaProducer extends GenericKafkaProducer implements SaasMessageProducer {

    public SaasKafkaProducer(KafkaTemplate<String, Object> ossKafkaTemplate) {
        super(ossKafkaTemplate);
    }

    @Override
    public <T> void sendMessage(String topic, T message, String key) {
        sendMessage(topic, key, message);
    }
}
