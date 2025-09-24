package com.openframe.kafka.producer;

import com.openframe.kafka.model.KafkaMessage;

public interface MessageProducer {

    void sendMessage(String messageDestinationName, KafkaMessage message, String specificKey);

}
