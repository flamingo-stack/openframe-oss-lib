package com.openframe.kafka.producer;

import com.openframe.kafka.model.CommonMessage;
import org.springframework.kafka.core.KafkaTemplate;

public class OssTenantKafkaProducer extends GenericKafkaProducer implements OssTenantMessageProducer {

    public OssTenantKafkaProducer(KafkaTemplate<String, Object> ossTenantKafkaTemplate) {
        super(ossTenantKafkaTemplate);
    }

    @Override
    public void sendMessage(String topic, CommonMessage message, String key) {
        sendMessage(topic, key, message);
    }
}
