package com.openframe.data.nats.rmm.publisher;

import com.openframe.data.nats.publisher.NatsMessagePublisher;
import com.openframe.data.nats.rmm.model.ScriptScheduleExecutionMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import static java.lang.String.format;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty("spring.cloud.stream.enabled")
@Slf4j
public class ScriptScheduleNatsPublisher {

    private static final String SUBJECT_TEMPLATE = "machine.%s.script-schedule-execution";

    private final NatsMessagePublisher natsMessagePublisher;

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
