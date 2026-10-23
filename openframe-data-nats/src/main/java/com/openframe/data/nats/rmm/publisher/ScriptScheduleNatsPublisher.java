package com.openframe.data.nats.rmm.publisher;

import com.openframe.data.nats.publisher.NatsMessagePublisher;
import com.openframe.data.nats.rmm.model.ScriptScheduleExecutionMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty("spring.cloud.stream.enabled")
@Slf4j
public class ScriptScheduleNatsPublisher extends AbstractMachineNatsPublisher {

    private static final String SUBJECT_TEMPLATE = "machine.%s.script-schedule-execution";

    public ScriptScheduleNatsPublisher(NatsMessagePublisher natsMessagePublisher) {
        super(natsMessagePublisher);
    }

    public void publish(String machineId, ScriptScheduleExecutionMessage message) {
        if (message == null) {
            throw new IllegalArgumentException("ScriptScheduleExecutionMessage must not be null");
        }
        String subject = send(SUBJECT_TEMPLATE, machineId, message);
        int scriptCount = message.getScripts() == null ? 0 : message.getScripts().size();
        log.info("Published schedule-execution batch: machineId={} subject={} executionId={} scheduleId={} scripts={}",
                machineId, subject, message.getExecutionId(), message.getScheduleId(), scriptCount);
    }
}
