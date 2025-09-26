package com.openframe.kafka.producer;

import com.openframe.kafka.model.KafkaMessage;
import org.springframework.kafka.support.SendResult;

import java.util.concurrent.CompletableFuture;

public interface MessageProducer {

    CompletableFuture<SendResult<String, Object>> sendAsyncMessage(String messageDestinationName, KafkaMessage message, String specificKey);

    void sendAndAwaitMessage(String messageDestinationName, KafkaMessage message, String specificKey);

}
