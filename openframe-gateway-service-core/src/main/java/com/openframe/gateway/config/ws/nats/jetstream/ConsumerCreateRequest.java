package com.openframe.gateway.config.ws.nats.jetstream;

import lombok.Builder;
import lombok.Value;

import java.util.List;
import java.util.Optional;

/**
 * What a consumer-create asks for, as far as access goes: the stream, the subjects the consumer
 * will deliver ({@code filter_subject} / {@code filter_subjects}; empty means the whole stream) and,
 * for a push consumer, where it delivers them.
 */
@Value
@Builder
public class ConsumerCreateRequest {

    String stream;
    List<String> filterSubjects;
    String deliverSubject;

    public Optional<String> getDeliverSubject() {
        return Optional.ofNullable(deliverSubject);
    }

    public boolean isUnfiltered() {
        return filterSubjects.isEmpty();
    }
}
