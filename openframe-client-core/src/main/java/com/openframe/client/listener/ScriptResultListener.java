package com.openframe.client.listener;

import com.openframe.client.service.RmmResultService;
import com.openframe.client.service.NatsTopicMachineIdExtractor;
import com.openframe.data.nats.rmm.model.RmmResultParser;
import com.openframe.data.nats.rmm.model.ScriptResultMessage;
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
 * Subscribes to script-result messages published by the agent over
 * <b>core NATS</b> on {@code machine.*.script-execution.result} (fire-and-forget,
 * non-durable — mirrors the dispatch path).
 *
 * <p>A script result is structurally identical to a command result (same
 * {@link RmmResultMessage} wire shape), so it is relayed through the same
 * {@link RmmResultService} — only the NATS subject differs from
 * {@link CommandResultListener}.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ScriptResultListener {

    private final Connection natsConnection;
    private final RmmResultParser resultParser;
    private final RmmResultService rmmResultService;
    private final NatsTopicMachineIdExtractor machineIdExtractor;

    private static final String SUBJECT = "machine.*.script-execution.result";

    private Dispatcher dispatcher;

    @EventListener(ApplicationReadyEvent.class)
    public void subscribeToScriptResults() {
        try {
            // NATS Dispatcher manages threads internally
            dispatcher = natsConnection.createDispatcher();
            dispatcher.subscribe(SUBJECT, this::handleMessage);
            log.info("Subscribed to script results: subject={}", SUBJECT);
        } catch (Exception e) {
            log.error("Failed to subscribe to script results", e);
            throw new RuntimeException("Failed to subscribe to script results", e);
        }
    }

    private void handleMessage(Message message) {
        String subject = message.getSubject();
        byte[] data = message.getData();
        try {
            String machineId = machineIdExtractor.extract(subject);
            ScriptResultMessage resultMessage = resultParser.parse(data, ScriptResultMessage.class);

            log.info("Processing script result: machineId={} executionId={} exitCode={} timedOut={}",
                    machineId, resultMessage.getExecutionId(), resultMessage.getExitCode(), resultMessage.getTimedOut());

            // Subtype is the discriminator — RmmResultService will derive MessageType.SCRIPT_EXECUTED.
            rmmResultService.processResult(machineId, resultMessage);
        } catch (Exception e) {
            // Log metadata only — the raw payload may contain sensitive script output.
            log.error("Unexpected error processing script result from subject {} (payloadSize={} bytes)",
                    subject, data.length, e);
        }
    }

    @PreDestroy
    public void cleanup() {
        if (dispatcher != null) {
            try {
                dispatcher.drain(Duration.ofSeconds(5));
                log.info("Script result dispatcher drained successfully");
            } catch (Exception e) {
                log.error("Error draining script result dispatcher", e);
            }
        }
    }
}
