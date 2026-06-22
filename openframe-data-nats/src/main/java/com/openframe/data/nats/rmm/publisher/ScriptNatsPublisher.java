package com.openframe.data.nats.rmm.publisher;

import com.openframe.data.nats.publisher.NatsMessagePublisher;
import com.openframe.data.nats.rmm.model.ScriptMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import static java.lang.String.format;

/**
 * Domain publisher for RMM saved-script executions sent to an agent over core NATS.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty("spring.cloud.stream.enabled")
@Slf4j
public class ScriptNatsPublisher {

    private static final String SCRIPT_SUBJECT_TEMPLATE = "machine.%s.script-execution";

    private final NatsMessagePublisher natsMessagePublisher;

    /**
     * Publish a script-execution to the target agent over core NATS.
     *
     * <p>{@code machineId} is expected to be a subject-safe token — that is
     * validated at the API boundary ({@code @Pattern} on the GraphQL input).
     *
     * @throws IllegalArgumentException if {@code message} is null
     * @throws com.openframe.core.exception.NatsException if the underlying
     *         NATS publish fails
     */
    public void publishScript(String machineId, ScriptMessage message) {
        if (message == null) {
            throw new IllegalArgumentException("ScriptMessage must not be null");
        }

        String subject = format(SCRIPT_SUBJECT_TEMPLATE, machineId);
        natsMessagePublisher.publish(subject, message);
        log.info("Published script: machineId={} subject={}", machineId, subject);
    }
}
