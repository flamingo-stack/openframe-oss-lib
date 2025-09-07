package com.openframe.kafka.producer;

public interface SaasMessageProducer {

    <T> void sendMessage(String messageDestinationName, T message, String specificKey);

}
