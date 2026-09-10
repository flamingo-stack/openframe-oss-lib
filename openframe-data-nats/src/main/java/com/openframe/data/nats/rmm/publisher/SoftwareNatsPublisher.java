package com.openframe.data.nats.rmm.publisher;

import com.openframe.data.nats.publisher.NatsMessagePublisher;
import com.openframe.data.nats.rmm.model.ScriptMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import static java.lang.String.format;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty("spring.cloud.stream.enabled")
@Slf4j
public class SoftwareNatsPublisher {

    private static final String SOFTWARE_SUBJECT_TEMPLATE = "machine.%s.software-execution";

    private final NatsMessagePublisher natsMessagePublisher;

    public void publishSoftware(String machineId, ScriptMessage message) {
        if (message == null) {
            throw new IllegalArgumentException("ScriptMessage must not be null");
        }

        String subject = format(SOFTWARE_SUBJECT_TEMPLATE, machineId);
        natsMessagePublisher.publish(subject, message);
        log.info("Published software execution: machineId={} subject={} executionId={} scriptId={}",
                machineId, subject, message.getExecutionId(), message.getScriptId());
    }
}
