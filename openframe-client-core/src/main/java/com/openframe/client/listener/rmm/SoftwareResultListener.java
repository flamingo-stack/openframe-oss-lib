package com.openframe.client.listener.rmm;

import com.openframe.client.service.rmm.RmmResultService;
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

@Component
@RequiredArgsConstructor
@Slf4j
public class SoftwareResultListener {

    private final Connection natsConnection;
    private final RmmResultParser resultParser;
    private final RmmResultService rmmResultService;
    private final NatsTopicMachineIdExtractor machineIdExtractor;

    private static final String SUBJECT = "machine.*.software-execution.result";

    private Dispatcher dispatcher;

    @EventListener(ApplicationReadyEvent.class)
    public void subscribeToSoftwareResults() {
        try {
            dispatcher = natsConnection.createDispatcher();
            dispatcher.subscribe(SUBJECT, this::handleMessage);
            log.info("Subscribed to software results: subject={}", SUBJECT);
        } catch (Exception e) {
            log.error("Failed to subscribe to software results", e);
            throw new RuntimeException("Failed to subscribe to software results", e);
        }
    }

    private void handleMessage(Message message) {
        String subject = message.getSubject();
        byte[] data = message.getData();
        try {
            String machineId = machineIdExtractor.extract(subject);
            ScriptResultMessage resultMessage = resultParser.parse(data, ScriptResultMessage.class);

            log.info("Processing software result: machineId={} executionId={} scriptId={} exitCode={} timedOut={}",
                    machineId, resultMessage.getExecutionId(), resultMessage.getScriptId(),
                    resultMessage.getExitCode(), resultMessage.getTimedOut());

            rmmResultService.processResult(machineId, resultMessage);
        } catch (Exception e) {
            log.error("Unexpected error processing software result from subject {} (payloadSize={} bytes)",
                    subject, data.length, e);
        }
    }

    @PreDestroy
    public void cleanup() {
        if (dispatcher != null) {
            try {
                dispatcher.drain(Duration.ofSeconds(5));
                log.info("Software result dispatcher drained successfully");
            } catch (Exception e) {
                log.error("Error draining software result dispatcher", e);
            }
        }
    }
}
