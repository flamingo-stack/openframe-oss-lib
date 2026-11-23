package com.openframe.gateway.config.ws.nats.jetstream;

import lombok.Builder;
import lombok.Value;

import java.util.List;
import java.util.Optional;

/**
 * What a consumer-create asks for, as far as access goes: the stream, the subjects the consumer
 * will deliver ({@code filter_subject} / {@code filter_subjects}; empty means the whole stream) and,
 * for a push consumer, where it delivers them. A request that names its filter in two places that
 * disagree is {@link #isAmbiguous() ambiguous}: the gateway must not authorize one reading while
 * NATS might apply the other.
 */
@Value
@Builder
public class ConsumerCreateRequest {

    String stream;
    List<String> filterSubjects;
    String deliverSubject;
    String ambiguity;
    /** A durable consumer outlives the client and its state stays on the stream until someone deletes it. */
    boolean durable;

    public Optional<String> getDeliverSubject() {
        return Optional.ofNullable(deliverSubject);
    }

    public Optional<String> getAmbiguity() {
        return Optional.ofNullable(ambiguity);
    }

    public boolean isAmbiguous() {
        return ambiguity != null;
    }

    public boolean isUnfiltered() {
        return filterSubjects.isEmpty();
    }
}
