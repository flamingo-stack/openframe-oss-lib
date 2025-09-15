package com.openframe.kafka.producer;

import com.openframe.kafka.model.KafkaMessage;

public interface SaasMessageProducer {

    void sendFromTenantMessage(String messageDestinationName, KafkaMessage message, String clusterId, String specificKey);

    void sendToTenantMessage(String messageDestinationName, KafkaMessage message, String clusterId, String specificKey);

    void sendSaasToSaasMessage(String messageDestinationName, KafkaMessage message, String specificKey);

}
