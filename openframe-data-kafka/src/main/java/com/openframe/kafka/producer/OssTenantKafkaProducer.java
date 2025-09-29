package com.openframe.kafka.producer;

import com.openframe.kafka.model.KafkaMessage;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;

import java.util.concurrent.CompletableFuture;

public class OssTenantKafkaProducer extends GenericKafkaProducer implements MessageProducer {

    public OssTenantKafkaProducer(KafkaTemplate<String, Object> ossTenantKafkaTemplate) {
        super(ossTenantKafkaTemplate);
    }

    @Override
    public CompletableFuture<SendResult<String, Object>> sendAsyncMessage(String topic, KafkaMessage message, String key) {
        return sendAsync(topic, key, message);
    }

    @Override
    public void sendAndAwaitMessage(String messageDestinationName, KafkaMessage message, String key) {
        sendAndAwait(messageDestinationName, key, message);
    }
}
