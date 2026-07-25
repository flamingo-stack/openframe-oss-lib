package com.openframe.data.nats.rmm.publisher;

import com.openframe.data.nats.publisher.NatsMessagePublisher;
import com.openframe.data.nats.rmm.model.ScriptScheduleExecutionMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import static java.lang.String.format;

/**
 * Domain publisher for RMM schedule fires sent to an agent over core NATS. One
 * message per target machine carries every script the schedule runs — see
 * {@link ScriptScheduleExecutionMessage}. The per-script {@code ScriptNatsPublisher}
 * stays alive for ad-hoc {@code runScript} / {@code batchRunScript} dispatches.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty("spring.cloud.stream.enabled")
@Slf4j
public class ScriptScheduleExecutionNatsPublisher {

    private static final String SUBJECT_TEMPLATE = "machine.%s.script-schedule-execution";

    private final NatsMessagePublisher natsMessagePublisher;

    /**
     * Publish a schedule-fire batch to the target agent over core NATS.
     *
     * <p>{@code machineId} is expected to be a subject-safe token — that is
     * validated at the API boundary ({@code @Pattern} on the GraphQL input).
     *
     * @throws IllegalArgumentException if {@code message} is null
     * @throws com.openframe.core.exception.NatsException if the underlying
     *         NATS publish fails
     */
    public void publish(String machineId, ScriptScheduleExecutionMessage message) {
        if (message == null) {
            throw new IllegalArgumentException("ScriptScheduleExecutionMessage must not be null");
        }

        String subject = format(SUBJECT_TEMPLATE, machineId);
        natsMessagePublisher.publish(subject, message);
        int scriptCount = message.getScripts() == null ? 0 : message.getScripts().size();
        log.info("Published schedule-execution batch: machineId={} subject={} executionId={} scheduleId={} scripts={}",
                machineId, subject, message.getExecutionId(), message.getScheduleId(), scriptCount);
    }
}
