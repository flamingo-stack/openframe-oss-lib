package com.openframe.kafka.producer;

import com.openframe.kafka.model.CommonMessage;

public interface SaasMessageProducer {

    void sendMessage(String messageDestinationName, CommonMessage message, String specificKey);

}
