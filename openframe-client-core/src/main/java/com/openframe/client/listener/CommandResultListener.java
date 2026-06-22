package com.openframe.client.listener;

import com.openframe.client.service.RmmResultService;
import com.openframe.client.service.NatsTopicMachineIdExtractor;
import com.openframe.data.nats.rmm.model.CommandResultMessage;
import com.openframe.data.nats.rmm.model.RmmResultParser;
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
 * Subscribes to command-result messages published by the agent over
 * <b>core NATS</b> (fire-and-forget, non-durable — mirrors the dispatch path)
 * and hands them to {@link RmmResultService} to be relayed to Kafka.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class CommandResultListener {

    private final Connection natsConnection;
    private final RmmResultParser resultParser;
    private final RmmResultService rmmResultService;
    private final NatsTopicMachineIdExtractor machineIdExtractor;

    private static final String SUBJECT = "machine.*.command-execution.result";

    private Dispatcher dispatcher;

    @EventListener(ApplicationReadyEvent.class)
    public void subscribeToCommandResults() {
        try {
            // NATS Dispatcher manages threads internally
            dispatcher = natsConnection.createDispatcher();
            dispatcher.subscribe(SUBJECT, this::handleMessage);
            log.info("Subscribed to command results: subject={}", SUBJECT);
        } catch (Exception e) {
            log.error("Failed to subscribe to command results", e);
            throw new RuntimeException("Failed to subscribe to command results", e);
        }
    }

    private void handleMessage(Message message) {
        String subject = message.getSubject();
        byte[] data = message.getData();
        try {
            String machineId = machineIdExtractor.extract(subject);
            CommandResultMessage resultMessage = resultParser.parse(data, CommandResultMessage.class);

            log.info("Processing command result: machineId={} executionId={} exitCode={} timedOut={}",
                    machineId, resultMessage.getExecutionId(), resultMessage.getExitCode(), resultMessage.getTimedOut());

            // Subtype is the discriminator — RmmResultService will derive MessageType.COMMAND_EXECUTED.
            rmmResultService.processResult(machineId, resultMessage);
        } catch (Exception e) {
            // Log metadata only — the raw payload may contain sensitive command output.
            log.error("Unexpected error processing command result from subject {} (payloadSize={} bytes)",
                    subject, data.length, e);
        }
    }

    @PreDestroy
    public void cleanup() {
        if (dispatcher != null) {
            try {
                dispatcher.drain(Duration.ofSeconds(5));
                log.info("Command result dispatcher drained successfully");
            } catch (Exception e) {
                log.error("Error draining command result dispatcher", e);
            }
        }
    }
}
