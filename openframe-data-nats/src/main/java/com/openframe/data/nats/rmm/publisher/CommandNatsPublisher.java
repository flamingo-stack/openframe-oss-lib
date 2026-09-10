package com.openframe.data.nats.rmm.publisher;

import com.openframe.data.nats.publisher.NatsMessagePublisher;
import com.openframe.data.nats.rmm.model.CancelMessage;
import com.openframe.data.nats.rmm.model.CommandMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import static java.lang.String.format;
import static org.apache.commons.lang3.StringUtils.isBlank;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty("spring.cloud.stream.enabled")
@Slf4j
public class CommandNatsPublisher {

    private static final String MACHINE_SUBJECT_TEMPLATE = "machine.%s.command-execution";
    private static final String CANCEL_SUBJECT_TEMPLATE = "machine.%s.command-cancel";

    private final NatsMessagePublisher natsMessagePublisher;

    public void publishCommand(String machineId, CommandMessage message) {
        if (message == null || isBlank(message.getExecutionId())) {
            throw new IllegalArgumentException("CommandMessage and executionId must not be null/blank");
        }

        String subject = format(MACHINE_SUBJECT_TEMPLATE, machineId);
        natsMessagePublisher.publish(subject, message);
        log.info("Published command: executionId={} machineId={} subject={}",
                message.getExecutionId(), machineId, subject);
    }

    public void publishCancel(String machineId, CancelMessage message) {
        if (message == null || isBlank(message.getExecutionId())) {
            throw new IllegalArgumentException("CancelMessage and executionId must not be null/blank");
        }

        String subject = format(CANCEL_SUBJECT_TEMPLATE, machineId);
        natsMessagePublisher.publish(subject, message);
        log.info("Published cancel: executionId={} machineId={} subject={}",
                message.getExecutionId(), machineId, subject);
    }
}
