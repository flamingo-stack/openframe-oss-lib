package com.openframe.data.nats.rmm.publisher;

import com.openframe.data.nats.publisher.NatsMessagePublisher;
import com.openframe.data.nats.rmm.model.CancelMessage;
import com.openframe.data.nats.rmm.model.CommandMessage;
import io.nats.client.api.PublishAck;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import static java.lang.String.format;
import static org.apache.commons.lang3.StringUtils.isBlank;

/**
 * Domain publisher for RMM commands sent to an agent.
 *
 * <p>Sends a {@link CommandMessage} via NATS JetStream to the agent's subject
 * so the agent picks it up from its {@code SCRIPT_EXECUTION} stream.
 * Persistent publish so the message survives a brief broker / agent outage.
 *
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty("spring.cloud.stream.enabled")
@Slf4j
public class CommandNatsPublisher {

    private static final String MACHINE_SUBJECT_TEMPLATE = "machine.%s.script-execution";
    private static final String CANCEL_SUBJECT_TEMPLATE = "machine.%s.script-cancel";

    private final NatsMessagePublisher natsMessagePublisher;

    /**
     * Publish a command-execution to the target agent. Returns the JetStream
     * ack so callers can log / surface stream + sequence metadata for tracing.
     *
     * @throws IllegalArgumentException if {@code machineId} is blank or
     *         {@code message} / its {@code executionId} is null
     * @throws com.openframe.core.exception.NatsException if the underlying
     *         JetStream publish fails
     */
    public PublishAck publishCommand(String machineId, CommandMessage message) {
        if (isBlank(machineId)) {
            throw new IllegalArgumentException("machineId must not be blank when publishing a command");
        }
        if (message == null || isBlank(message.getExecutionId())) {
            throw new IllegalArgumentException("CommandMessage and executionId must not be null/blank");
        }

        String subject = format(MACHINE_SUBJECT_TEMPLATE, machineId);
        PublishAck ack = natsMessagePublisher.publishPersistent(subject, message);
        log.info("Published command: executionId={} machineId={} stream={} seq={}",
                message.getExecutionId(), machineId, ack.getStream(), ack.getSeqno());

        return ack;
    }

    /**
     * Publish a cancellation request for an in-flight execution.
     *
     *  @throws IllegalArgumentException if {@code machineId} is blank or
     *         {@code message} / its {@code executionId} is null
     * @throws com.openframe.core.exception.NatsException if the underlying
     *         JetStream publish fails
     */
    public PublishAck publishCancel(String machineId, CancelMessage message) {
        if (isBlank(machineId)) {
            throw new IllegalArgumentException("machineId must not be blank when publishing a cancel");
        }
        if (message == null || isBlank(message.getExecutionId())) {
            throw new IllegalArgumentException("CancelMessage and executionId must not be null/blank");
        }

        String subject = format(CANCEL_SUBJECT_TEMPLATE, machineId);
        PublishAck ack = natsMessagePublisher.publishPersistent(subject, message);
        log.info("Published cancel: executionId={} machineId={} stream={} seq={}",
                message.getExecutionId(), machineId, ack.getStream(), ack.getSeqno());
        return ack;
    }
}
