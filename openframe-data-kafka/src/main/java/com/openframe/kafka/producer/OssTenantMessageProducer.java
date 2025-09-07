package com.openframe.kafka.producer;

public interface OssTenantMessageProducer {

    <T> void sendMessage(String messageDestinationName, T message, String specificKey);

}
