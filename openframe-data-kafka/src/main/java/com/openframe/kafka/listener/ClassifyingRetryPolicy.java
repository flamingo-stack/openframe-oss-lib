package com.openframe.kafka.listener;

import lombok.Builder;
import lombok.Singular;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.dao.ConcurrencyFailureException;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.dao.TransientDataAccessException;
import org.springframework.kafka.support.ExponentialBackOffWithMaxRetries;
import org.springframework.kafka.support.serializer.DeserializationException;
import org.springframework.util.backoff.BackOff;
import org.springframework.util.backoff.FixedBackOff;

import java.time.Duration;
import java.util.List;
import java.util.stream.Stream;

// Retries by the kind of failure, anywhere in the cause chain: a record no retry can fix goes to the dead-letter
// topic at once; an unreachable store is waited out without limit, so the partition waits and nothing is
// dead-lettered by an outage; anything else gets `retries` more attempts with an exponential pause. An optimistic-lock
// conflict is not an outage: it gets the attempts, so it cannot hold a partition forever.
@Builder
public class ClassifyingRetryPolicy implements ConsumerRetryPolicy {

    private static final List<Class<? extends Throwable>> BUILT_IN_NOT_RETRYABLE =
            List.of(DeserializationException.class);
    private static final List<Class<? extends Throwable>> BUILT_IN_UNAVAILABLE =
            List.of(DataAccessResourceFailureException.class, TransientDataAccessException.class);
    private static final List<Class<? extends Throwable>> NEVER_UNAVAILABLE = List.of(ConcurrencyFailureException.class);

    @Singular("notRetryable")
    private final List<Class<? extends Throwable>> notRetryable;
    @Singular("unavailable")
    private final List<Class<? extends Throwable>> unavailable;
    @Builder.Default
    private final Duration unavailableInterval = Duration.ofSeconds(5);
    @Builder.Default
    private final int retries = 4;
    @Builder.Default
    private final Duration initialInterval = Duration.ofSeconds(1);
    @Builder.Default
    private final double multiplier = 3.0;
    @Builder.Default
    private final Duration maxInterval = Duration.ofSeconds(30);

    public static ClassifyingRetryPolicy defaults() {
        return builder().build();
    }

    @Override
    public BackOff backOffFor(ConsumerRecord<?, ?> record, Exception failure) {
        List<Class<? extends Throwable>> notRetryableTypes =
                Stream.concat(BUILT_IN_NOT_RETRYABLE.stream(), notRetryable.stream()).toList();
        if (causedByAny(failure, notRetryableTypes)) {
            return new FixedBackOff(0L, 0L);
        }
        if (isUnavailable(failure)) {
            return new FixedBackOff(unavailableInterval.toMillis(), FixedBackOff.UNLIMITED_ATTEMPTS);
        }
        ExponentialBackOffWithMaxRetries backOff = new ExponentialBackOffWithMaxRetries(retries);
        backOff.setInitialInterval(initialInterval.toMillis());
        backOff.setMultiplier(multiplier);
        backOff.setMaxInterval(maxInterval.toMillis());
        return backOff;
    }

    private boolean isUnavailable(Exception failure) {
        List<Class<? extends Throwable>> unavailableTypes =
                Stream.concat(BUILT_IN_UNAVAILABLE.stream(), unavailable.stream()).toList();
        return !causedByAny(failure, NEVER_UNAVAILABLE) && causedByAny(failure, unavailableTypes);
    }

    private static boolean causedByAny(Throwable failure, List<Class<? extends Throwable>> types) {
        for (Throwable cause = failure; cause != null; cause = cause.getCause()) {
            Throwable current = cause;
            if (types.stream().anyMatch(type -> type.isInstance(current))) {
                return true;
            }
        }
        return false;
    }
}
