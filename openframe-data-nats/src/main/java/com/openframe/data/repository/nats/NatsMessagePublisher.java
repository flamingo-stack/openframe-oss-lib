package com.openframe.data.repository.nats;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.core.exception.NatsException;
import io.nats.client.Connection;
import io.nats.client.JetStream;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.cloud.stream.function.StreamBridge;
import org.springframework.integration.support.MessageBuilder;
import org.springframework.messaging.Message;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty("spring.cloud.stream.enabled")
public class NatsMessagePublisher {

    private final StreamBridge streamBridge;
    private final ObjectMapper objectMapper;
    private final Connection natsConnection;

    public <T> void publish(String subject, T payload) {
        try {
            Message<T> message = MessageBuilder
                    .withPayload(payload)
                    .build();

            boolean result = streamBridge.send(subject, message);
            if (result) {
                log.info("Successfully published message to subject: {}", subject);
            } else {
                throw new NatsException("Failed to publish message to subject: " + subject);
            }
        } catch (Exception e) {
            throw new NatsException("Error publishing message to subject: " + subject, e);
        }
    }

    public <T> void publishPersistent(String subject, T payload) {
        try {
            JetStream js = natsConnection.jetStream();
            byte[] body = objectMapper.writeValueAsBytes(payload);
            js.publish(subject, body);
            log.info("Successfully published persistent message to JetStream subject: {}", subject);
        } catch (Exception e) {
            throw new NatsException("Error publishing persistent message to subject: " + subject, e);
        }
    }
} 