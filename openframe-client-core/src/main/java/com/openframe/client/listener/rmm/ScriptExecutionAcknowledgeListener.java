package com.openframe.client.listener.rmm;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.client.service.rmm.ScriptExecutionAcknowledgeService;
import com.openframe.data.nats.rmm.model.ScriptExecutionAcknowledgeMessage;
import io.nats.client.Connection;
import io.nats.client.Dispatcher;
import io.nats.client.Message;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * Subscribes to delivery acknowledgements the agent publishes over core NATS on
 * {@code machine.*.execution.acknowledge} when it accepts and starts a dispatched script. Each ack
 * flips its leaf from {@code QUEUED} to {@code RUNNING} and stops the delivery retry for that machine.
 *
 * <p>Mirrors {@link ScriptResultListener}: a non-durable core-NATS subscription managed by a Dispatcher.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ScriptExecutionAcknowledgeListener {

    private static final String SUBJECT = "machine.*.execution.acknowledge";

    private final Connection natsConnection;
    private final ObjectMapper objectMapper;
    private final ScriptExecutionAcknowledgeService acknowledgeService;

    private Dispatcher dispatcher;

    @EventListener(ApplicationReadyEvent.class)
    public void subscribeToAcknowledgements() {
        try {
            dispatcher = natsConnection.createDispatcher();
            dispatcher.subscribe(SUBJECT, this::handleMessage);
            log.info("Subscribed to execution acknowledgements: subject={}", SUBJECT);
        } catch (Exception e) {
            log.error("Failed to subscribe to execution acknowledgements", e);
            throw new RuntimeException("Failed to subscribe to execution acknowledgements", e);
        }
    }

    private void handleMessage(Message message) {
        String subject = message.getSubject();
        try {
            ScriptExecutionAcknowledgeMessage ack =
                    objectMapper.readValue(message.getData(), ScriptExecutionAcknowledgeMessage.class);
            acknowledgeService.acknowledge(ack);
        } catch (Exception e) {
            log.error("Unexpected error processing execution ack from subject {}", subject, e);
        }
    }

    @PreDestroy
    public void cleanup() {
        if (dispatcher != null) {
            try {
                dispatcher.drain(Duration.ofSeconds(5));
                log.info("Execution ack dispatcher drained successfully");
            } catch (Exception e) {
                log.error("Error draining execution ack dispatcher", e);
            }
        }
    }
}
