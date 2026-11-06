package com.openframe.data.retry;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.dao.TransientDataAccessResourceException;
import org.springframework.retry.support.RetryTemplate;

import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@ExtendWith(OutputCaptureExtension.class)
class OptimisticLockingRetryListenerTest {

    private static final String EXHAUSTED = "OLE retry exhausted";
    private static final String SUCCEEDED = "OLE retry succeeded";
    private static final String ATTEMPT_FAILED = "OLE retry attempt";

    private final RetryTemplate retryTemplate = RetryTemplate.builder()
            .maxAttempts(3)
            .retryOn(List.of(OptimisticLockingFailureException.class, TransientDataAccessResourceException.class))
            .noBackoff()
            .withListener(new OptimisticLockingRetryListener())
            .build();

    @Test
    void aConflictFixedByARetry_logsTheAttemptAndTheSuccess(CapturedOutput output) {
        AtomicInteger calls = new AtomicInteger();

        retryTemplate.execute(context -> {
            if (calls.incrementAndGet() == 1) {
                throw new OptimisticLockingFailureException("stale");
            }
            return "saved";
        });

        assertThat(output).contains(ATTEMPT_FAILED, SUCCEEDED)
                .doesNotContain(EXHAUSTED, OptimisticLockingRetryListener.UPDATE_NOT_SAVED_MARKER);
    }

    @Test
    void conflictsUntilTheLastAttempt_logExhaustedOnce(CapturedOutput output) {
        assertThatThrownBy(() -> retryTemplate.execute(context -> {
            throw new OptimisticLockingFailureException("stale");
        })).isInstanceOf(OptimisticLockingFailureException.class);

        assertThat(output.toString().split(EXHAUSTED, -1)).hasSize(2);
        assertThat(output).contains(OptimisticLockingRetryListener.UPDATE_NOT_SAVED_MARKER);
    }

    @Test
    void aFailoverUntilTheLastAttempt_logsTheUpdateAsNotSaved(CapturedOutput output) {
        assertThatThrownBy(() -> retryTemplate.execute(context -> {
            throw new TransientDataAccessResourceException("primary stepped down");
        })).isInstanceOf(TransientDataAccessResourceException.class);

        assertThat(output).contains(ATTEMPT_FAILED, OptimisticLockingRetryListener.UPDATE_NOT_SAVED_MARKER);
    }

    @Test
    void anotherExceptionOfTheMethod_logsNothing(CapturedOutput output) {
        assertThatThrownBy(() -> retryTemplate.execute(context -> {
            throw new IllegalStateException("machine not found");
        })).isInstanceOf(IllegalStateException.class);

        assertThat(output).doesNotContain(ATTEMPT_FAILED, SUCCEEDED, EXHAUSTED,
                OptimisticLockingRetryListener.UPDATE_NOT_SAVED_MARKER);
    }

    @Test
    void aFirstAttemptThatWorks_logsNothing(CapturedOutput output) {
        retryTemplate.execute(context -> "saved");

        assertThat(output).doesNotContain(ATTEMPT_FAILED, SUCCEEDED, EXHAUSTED);
    }
}
