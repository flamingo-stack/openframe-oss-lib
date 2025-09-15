package com.openframe.kafka.producer;

import com.openframe.kafka.model.KafkaMessage;
import lombok.extern.slf4j.Slf4j;

/**
 * Stub implementation of SaasMessageProducer for OSS version.
 * This implementation provides empty methods that do nothing.
 * Used when SAAS functionality is not available or not configured.
 */
@Slf4j
public class StubSaasMessageProducer implements SaasMessageProducer {

    @Override
    public void sendFromTenantMessage(String messageDestinationName, KafkaMessage message, String clusterId, String specificKey) {
        debugLogMethod(messageDestinationName, specificKey);
    }

    @Override
    public void sendToTenantMessage(String messageDestinationName, KafkaMessage message, String clusterId, String specificKey) {
        debugLogMethod(messageDestinationName, specificKey);
    }

    @Override
    public void sendSaasToSaasMessage(String messageDestinationName, KafkaMessage message, String specificKey) {
        debugLogMethod(messageDestinationName, specificKey);
    }

    private void debugLogMethod(String messageDestinationName, String specificKey) {
        log.debug("Stub SAAS message producer: ignoring message to topic '{}' with key '{}'",
                messageDestinationName, specificKey);
    }
}
