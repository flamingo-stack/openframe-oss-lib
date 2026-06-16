package com.openframe.client.listener;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.client.service.CommandResultService;
import com.openframe.client.service.NatsTopicMachineIdExtractor;
import com.openframe.client.service.ScriptResultService;
import com.openframe.data.nats.rmm.model.CommandResultMessage;
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

@Component
@RequiredArgsConstructor
@Slf4j
public class ScriptResultListener {

    private final Connection natsConnection;
    private final ObjectMapper objectMapper;
    private final ScriptResultService scriptResultService;
    private final CommandResultService commandResultService;
    private final NatsTopicMachineIdExtractor machineIdExtractor;

    private static final String SUBJECT = "machine.*.script-execution.result";

    private Dispatcher dispatcher;

    @EventListener(ApplicationReadyEvent.class)
    public void subscribeToCommandResults() {
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
            CommandResultMessage resultMessage = objectMapper.readValue(data, CommandResultMessage.class);

            log.info("Processing script result: machineId={} executionId={} exitCode={} timedOut={}",
                    machineId, resultMessage.getExecutionId(), resultMessage.getExitCode(), resultMessage.getTimedOut());

            //will it be the same processing???
            commandResultService.processCommandResult(machineId, resultMessage);
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
