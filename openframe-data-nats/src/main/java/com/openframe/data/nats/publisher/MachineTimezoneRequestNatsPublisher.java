package com.openframe.data.nats.publisher;

import com.openframe.data.nats.model.MachineTimezoneRequestMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Instant;

import static java.lang.String.format;

/**
 * Asks an agent to report its machine's timezone over core NATS on
 * {@code machine.<machineId>.timezone.request} (same fire-and-forget wire as the schedule-execution
 * command). The agent replies on {@code machine.<machineId>.timezone} (see
 * {@code MachineTimezoneListener}). A request lost because the device was offline is self-healing:
 * the DEVICE_LOCAL runner re-requests on each sweep while a target's timezone is still unknown.
 */
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
        natsMessagePublisher.publish(subject, message);
        log.info("Requested timezone from agent: machineId={} subject={} scheduleId={}", machineId, subject, scheduleId);
    }
}
