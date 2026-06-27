package com.openframe.data.nats.publisher;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.core.exception.NatsException;
import io.nats.client.Connection;
import io.nats.client.JetStream;
import io.nats.client.api.PublishAck;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty("spring.cloud.stream.enabled")
public class NatsMessagePublisher {

    private final ObjectMapper objectMapper;
    private final Connection natsConnection;

    public <T> void publish(String subject, T payload) {
        try {
            byte[] body = objectMapper.writeValueAsBytes(payload);
            natsConnection.publish(subject, body);
        } catch (Exception e) {
            throw new NatsException("Error publishing message to subject: " + subject, e);
        }
    }

    public <T> PublishAck publishPersistent(String subject, T payload) {
        try {
            JetStream js = natsConnection.jetStream();
            byte[] body = objectMapper.writeValueAsBytes(payload);
            return js.publish(subject, body);
        } catch (Exception e) {
            throw new NatsException("Error publishing persistent message to subject: " + subject, e);
        }
    }
}