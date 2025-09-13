package com.openframe.kafka.producer;

import lombok.extern.slf4j.Slf4j;

/**
 * Stub implementation of SaasMessageProducer for OSS version.
 * This implementation provides empty methods that do nothing.
 * Used when SAAS functionality is not available or not configured.
 */
@Slf4j
public class StubSaasMessageProducer implements SaasMessageProducer {

    @Override
    public <T> void sendMessage(String messageDestinationName, T message, String specificKey) {
        log.debug("Stub SAAS message producer: ignoring message to topic '{}' with key '{}'", 
                 messageDestinationName, specificKey);
        // Empty implementation - does nothing
    }
}
