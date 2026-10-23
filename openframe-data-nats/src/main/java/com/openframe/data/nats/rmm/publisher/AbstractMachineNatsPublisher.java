package com.openframe.data.nats.rmm.publisher;

import com.openframe.data.nats.publisher.NatsMessagePublisher;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;

import static java.lang.String.format;

@RequiredArgsConstructor(access = AccessLevel.PROTECTED)
public abstract class AbstractMachineNatsPublisher {

    protected final NatsMessagePublisher natsMessagePublisher;

    protected String send(String subjectTemplate, String machineId, Object message) {
        String subject = format(subjectTemplate, machineId);
        natsMessagePublisher.publish(subject, message);
        return subject;
    }
}
