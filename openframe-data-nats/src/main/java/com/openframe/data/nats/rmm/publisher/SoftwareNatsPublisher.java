package com.openframe.data.nats.rmm.publisher;

import com.openframe.data.nats.publisher.NatsMessagePublisher;
import com.openframe.data.nats.rmm.model.ScriptMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = {"spring.cloud.stream.enabled", "openframe.rmm.software.enabled"}, havingValue = "true")
@Slf4j
public class SoftwareNatsPublisher extends AbstractMachineNatsPublisher {

    private static final String SUBJECT_TEMPLATE = "machine.%s.software-execution";

    public SoftwareNatsPublisher(NatsMessagePublisher natsMessagePublisher) {
        super(natsMessagePublisher);
    }

    public void publishSoftware(String machineId, ScriptMessage message) {
        if (message == null) {
            throw new IllegalArgumentException("ScriptMessage must not be null");
        }
        String subject = send(SUBJECT_TEMPLATE, machineId, message);
        log.info("Published software execution: machineId={} subject={} executionId={} scriptId={}",
                machineId, subject, message.getExecutionId(), message.getScriptId());
    }
}
