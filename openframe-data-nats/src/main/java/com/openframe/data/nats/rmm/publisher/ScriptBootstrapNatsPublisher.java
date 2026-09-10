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
public class ScriptBootstrapNatsPublisher {

    private static final String SUBJECT_TEMPLATE = "machine.%s.script-bootstrap-execution";

    private final NatsMessagePublisher natsMessagePublisher;

    public void publishBootstrapScript(String machineId, ScriptMessage message) {
        if (message == null) {
            throw new IllegalArgumentException("ScriptMessage must not be null");
        }

        String subject = format(SUBJECT_TEMPLATE, machineId);
        natsMessagePublisher.publish(subject, message);
        log.info("Published bootstrap script: machineId={} subject={}", machineId, subject);
    }
}
