package com.openframe.data.nats.rmm.publisher;

import com.openframe.data.nats.publisher.NatsMessagePublisher;
import com.openframe.data.nats.rmm.model.CancelMessage;
import com.openframe.data.nats.rmm.model.CommandMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import static org.apache.commons.lang3.StringUtils.isBlank;

@Component
@ConditionalOnProperty("spring.cloud.stream.enabled")
@Slf4j
public class CommandNatsPublisher extends AbstractMachineNatsPublisher {

    private static final String MACHINE_SUBJECT_TEMPLATE = "machine.%s.command-execution";
    private static final String CANCEL_SUBJECT_TEMPLATE = "machine.%s.command-cancel";

    public CommandNatsPublisher(NatsMessagePublisher natsMessagePublisher) {
        super(natsMessagePublisher);
    }

    public void publishCommand(String machineId, CommandMessage message) {
        if (message == null || isBlank(message.getExecutionId())) {
            throw new IllegalArgumentException("CommandMessage and executionId must not be null/blank");
        }
        String subject = send(MACHINE_SUBJECT_TEMPLATE, machineId, message);
        log.info("Published command: executionId={} machineId={} subject={}",
                message.getExecutionId(), machineId, subject);
    }

    public void publishCancel(String machineId, CancelMessage message) {
        if (message == null || isBlank(message.getExecutionId())) {
            throw new IllegalArgumentException("CancelMessage and executionId must not be null/blank");
        }
        String subject = send(CANCEL_SUBJECT_TEMPLATE, machineId, message);
        log.info("Published cancel: executionId={} machineId={} subject={}",
                message.getExecutionId(), machineId, subject);
    }
}
