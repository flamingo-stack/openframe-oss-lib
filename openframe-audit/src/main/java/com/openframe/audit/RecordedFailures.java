package com.openframe.audit;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import lombok.experimental.UtilityClass;
import org.apache.commons.lang3.exception.ExceptionUtils;

@UtilityClass
class RecordedFailures {

    private final Cache<Throwable, Boolean> recorded = Caffeine.newBuilder().weakKeys().build();

    void add(Throwable failure) {
        ExceptionUtils.getThrowableList(failure).forEach(thrown -> recorded.put(thrown, Boolean.TRUE));
    }

    boolean contains(Throwable failure) {
        return ExceptionUtils.getThrowableList(failure).stream()
                .anyMatch(thrown -> recorded.getIfPresent(thrown) != null);
    }
}
