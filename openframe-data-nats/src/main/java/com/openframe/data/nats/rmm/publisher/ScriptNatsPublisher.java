package com.openframe.data.nats.rmm.publisher;

import com.openframe.data.nats.publisher.NatsMessagePublisher;
import com.openframe.data.nats.rmm.model.ScriptMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import static java.lang.String.format;
import static org.apache.commons.lang3.StringUtils.isBlank;

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
     * @throws IllegalArgumentException if {@code machineId} is blank or
     *         {@code message} / its {@code executionId} is null/blank
     * @throws com.openframe.core.exception.NatsException if the underlying
     *         NATS publish fails
     */
    public void publishScript(String machineId, ScriptMessage message) {
        if (isBlank(machineId)) {
            throw new IllegalArgumentException("machineId must not be blank when publishing a script");
        }
        if (message == null || isBlank(message.getExecutionId())) {
            throw new IllegalArgumentException("ScriptMessage and executionId must not be null/blank");
        }

        String subject = format(SCRIPT_SUBJECT_TEMPLATE, machineId);
        natsMessagePublisher.publish(subject, message);
        log.info("Published script: executionId={} machineId={} subject={}",
                message.getExecutionId(), machineId, subject);
    }
}
