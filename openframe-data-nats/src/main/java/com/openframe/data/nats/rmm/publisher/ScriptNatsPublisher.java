package com.openframe.data.nats.rmm.publisher;

import com.openframe.data.nats.publisher.NatsMessagePublisher;
import com.openframe.data.nats.rmm.model.ScriptMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty("spring.cloud.stream.enabled")
@Slf4j
public class ScriptNatsPublisher extends AbstractMachineNatsPublisher {

    private static final String SUBJECT_TEMPLATE = "machine.%s.script-execution";

    public ScriptNatsPublisher(NatsMessagePublisher natsMessagePublisher) {
        super(natsMessagePublisher);
    }

    public void publishScript(String machineId, ScriptMessage message) {
        if (message == null) {
            throw new IllegalArgumentException("ScriptMessage must not be null");
        }
        String subject = send(SUBJECT_TEMPLATE, machineId, message);
        log.info("Published script: machineId={} subject={}", machineId, subject);
    }
}
