package com.openframe.kafka.producer;

import com.openframe.kafka.model.CommonMessage;

public interface SaasMessageProducer {

    void sendFromTenantMessage(String messageDestinationName, CommonMessage message, String clusterId, String specificKey);

    void sendToTenantMessage(String messageDestinationName, CommonMessage message, String clusterId, String specificKey);

    void sendSaasToSaasMessage(String messageDestinationName, CommonMessage message, String specificKey);

}
