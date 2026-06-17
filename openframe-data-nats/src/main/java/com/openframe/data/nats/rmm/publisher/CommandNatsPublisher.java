package com.openframe.data.nats.rmm.publisher;

import com.openframe.data.nats.publisher.NatsMessagePublisher;
import com.openframe.data.nats.rmm.model.CancelMessage;
import com.openframe.data.nats.rmm.model.CommandMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import static java.lang.String.format;
import static org.apache.commons.lang3.StringUtils.isBlank;

/**
 * Domain publisher for RMM ad-hoc commands sent to an agent.
 *
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty("spring.cloud.stream.enabled")
@Slf4j
public class CommandNatsPublisher {

    private static final String MACHINE_SUBJECT_TEMPLATE = "machine.%s.command-execution";
    private static final String CANCEL_SUBJECT_TEMPLATE = "machine.%s.command-cancel";

    private final NatsMessagePublisher natsMessagePublisher;

    /**
     * Publish a command-execution to the target agent over core NATS.
     *
     * <p>{@code machineId} is expected to be a subject-safe token — that is
     * validated at the API boundary ({@code @Pattern} on the GraphQL input).
     *
     * @throws IllegalArgumentException if {@code message} / its
     *         {@code executionId} is null/blank
     * @throws com.openframe.core.exception.NatsException if the underlying
     *         NATS publish fails
     */
    public void publishCommand(String machineId, CommandMessage message) {
        if (message == null || isBlank(message.getExecutionId())) {
            throw new IllegalArgumentException("CommandMessage and executionId must not be null/blank");
        }

        String subject = format(MACHINE_SUBJECT_TEMPLATE, machineId);
        natsMessagePublisher.publish(subject, message);
        log.info("Published command: executionId={} machineId={} subject={}",
                message.getExecutionId(), machineId, subject);
    }

    /**
     * Publish a cancellation request for an in-flight execution.
     *
     * <p>{@code machineId} is expected to be a subject-safe token — that is
     * validated at the API boundary ({@code @Pattern} on the GraphQL input).
     *
     * @throws IllegalArgumentException if {@code message} / its
     *         {@code executionId} is null/blank
     * @throws com.openframe.core.exception.NatsException if the underlying
     *         NATS publish fails
     */
    public void publishCancel(String machineId, CancelMessage message) {
        if (message == null || isBlank(message.getExecutionId())) {
            throw new IllegalArgumentException("CancelMessage and executionId must not be null/blank");
        }

        String subject = format(CANCEL_SUBJECT_TEMPLATE, machineId);
        natsMessagePublisher.publish(subject, message);
        log.info("Published cancel: executionId={} machineId={} subject={}",
                message.getExecutionId(), machineId, subject);
    }
}
