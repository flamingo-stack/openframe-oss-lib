package com.openframe.data.nats.rmm.publisher;

import com.openframe.data.nats.publisher.NatsMessagePublisher;
import com.openframe.data.nats.rmm.model.ScriptMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty("spring.cloud.stream.enabled")
@Slf4j
public class ScriptBootstrapNatsPublisher extends AbstractMachineNatsPublisher {

    private static final String SUBJECT_TEMPLATE = "machine.%s.script-bootstrap-execution";

    public ScriptBootstrapNatsPublisher(NatsMessagePublisher natsMessagePublisher) {
        super(natsMessagePublisher);
    }

    public void publishBootstrapScript(String machineId, ScriptMessage message) {
        if (message == null) {
            throw new IllegalArgumentException("ScriptMessage must not be null");
        }
        String subject = send(SUBJECT_TEMPLATE, machineId, message);
        log.info("Published bootstrap script: machineId={} subject={}", machineId, subject);
    }
}
