package com.openframe.data.nats.publisher;

import com.openframe.data.nats.model.MachineTimezoneRequestMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Instant;

import static java.lang.String.format;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty("spring.cloud.stream.enabled")
@Slf4j
public class MachineTimezoneRequestNatsPublisher {

    private static final String SUBJECT_TEMPLATE = "machine.%s.timezone.request";

    private final NatsMessagePublisher natsMessagePublisher;

    public void request(String machineId, String scheduleId) {
        String subject = format(SUBJECT_TEMPLATE, machineId);
        MachineTimezoneRequestMessage message = new MachineTimezoneRequestMessage();
        message.setScheduleId(scheduleId);
        message.setRequestedAt(Instant.now().toString());
        natsMessagePublisher.publishPersistent(subject, message);
        log.debug("Requested timezone from agent: machineId={} subject={} scheduleId={}", machineId, subject, scheduleId);
    }
}
