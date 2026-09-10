package com.openframe.client.listener.rmm;

import com.openframe.client.service.NatsTopicMachineIdExtractor;
import com.openframe.client.service.rmm.RmmResultService;
import com.openframe.data.nats.rmm.model.RmmResultMessage;
import com.openframe.data.nats.rmm.model.RmmResultParser;
import io.nats.client.Connection;
import io.nats.client.Dispatcher;
import io.nats.client.Message;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;

import java.time.Duration;

public abstract class AbstractRmmResultListener<T extends RmmResultMessage> {

    private final Logger log = LoggerFactory.getLogger(getClass());

    private final Connection natsConnection;
    private final RmmResultParser resultParser;
    private final RmmResultService rmmResultService;
    private final NatsTopicMachineIdExtractor machineIdExtractor;

    private Dispatcher dispatcher;

    protected AbstractRmmResultListener(Connection natsConnection,
                                        RmmResultParser resultParser,
                                        RmmResultService rmmResultService,
                                        NatsTopicMachineIdExtractor machineIdExtractor) {
        this.natsConnection = natsConnection;
        this.resultParser = resultParser;
        this.rmmResultService = rmmResultService;
        this.machineIdExtractor = machineIdExtractor;
    }

    protected abstract String subject();

    protected abstract Class<T> messageType();

    protected abstract String label();

    @EventListener(ApplicationReadyEvent.class)
    public void subscribe() {
        try {
            dispatcher = natsConnection.createDispatcher();
            dispatcher.subscribe(subject(), this::handleMessage);
            log.info("Subscribed to {} results: subject={}", label(), subject());
        } catch (Exception e) {
            log.error("Failed to subscribe to {} results", label(), e);
            throw new RuntimeException("Failed to subscribe to " + label() + " results", e);
        }
    }

    private void handleMessage(Message message) {
        String subject = message.getSubject();
        byte[] data = message.getData();
        try {
            String machineId = machineIdExtractor.extract(subject);
            T resultMessage = resultParser.parse(data, messageType());

            log.info("Processing {} result: machineId={} executionId={} exitCode={} timedOut={}",
                    label(), machineId, resultMessage.getExecutionId(), resultMessage.getExitCode(),
                    resultMessage.getTimedOut());

            rmmResultService.processResult(machineId, resultMessage);
        } catch (Exception e) {
            // Log metadata only — the raw payload may contain sensitive script/command output.
            log.error("Unexpected error processing {} result from subject {} (payloadSize={} bytes)",
                    label(), subject, data.length, e);
        }
    }

    @PreDestroy
    public void cleanup() {
        if (dispatcher != null) {
            try {
                dispatcher.drain(Duration.ofSeconds(5));
                log.info("{} result dispatcher drained successfully", label());
            } catch (Exception e) {
                log.error("Error draining {} result dispatcher", label(), e);
            }
        }
    }
}
