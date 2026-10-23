package com.openframe.event.jobs.core.service;

import com.openframe.event.jobs.backfill.config.properties.EventBackfillProperties;
import com.openframe.event.jobs.core.persistence.EventJob;
import com.openframe.event.jobs.core.persistence.EventJobStatus;
import com.openframe.event.jobs.core.repository.EventJobRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.dao.OptimisticLockingFailureException;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class EventJobTickerTest {

    private static final Instant NOW = Instant.parse("2026-10-21T10:00:00Z");

    private final EventBackfillProperties settings = new EventBackfillProperties();
    private final EventJobRepository jobRepository = mock(EventJobRepository.class);
    private final EventJobShutdown shutdown = new EventJobShutdown();
    private final AtomicInteger batches = new AtomicInteger();
    private final AtomicBoolean failed = new AtomicBoolean();

    @BeforeEach
    void setUp() {
        settings.setPause(Duration.ZERO);
        when(jobRepository.save(any(EventJob.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @AfterEach
    void clearInterrupt() {
        Thread.interrupted();
    }

    @Test
    void aTick_stopsAtHalfTheLockTime_andTheRunStaysRunning() {
        // setup
        MovingClock clock = new MovingClock(NOW);
        EventJobTicker ticker = ticker(clock);
        EventJobBatch thirtySeconds = job -> {
            batches.incrementAndGet();
            clock.advance(Duration.ofSeconds(30));
            return job;
        };

        // execution
        ticker.tick("Test job", running(clock), settings, thirtySeconds, () -> failed.set(true));

        // verifications
        assertThat(batches).hasValue(2);
    }

    @Test
    void aTick_endsWhenABatchFinishesTheRun() {
        // setup
        Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
        EventJobTicker ticker = ticker(clock);
        EventJobBatch lastBatch = job -> {
            batches.incrementAndGet();
            return job.finishRun(EventJobStatus.DONE, NOW);
        };

        // execution
        ticker.tick("Test job", running(clock), settings, lastBatch, () -> failed.set(true));

        // verifications
        assertThat(batches).hasValue(1);
    }

    @Test
    void aStoppingService_endsTheTickAfterTheCurrentBatch() {
        // setup
        Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
        EventJobTicker ticker = ticker(clock);
        EventJobBatch stopsTheService = job -> {
            batches.incrementAndGet();
            shutdown.onApplicationEvent(null);
            return job;
        };

        // execution
        ticker.tick("Test job", running(clock), settings, stopsTheService, () -> failed.set(true));

        // verifications
        assertThat(batches).hasValue(1);
    }

    @Test
    void anInterruptedThread_endsTheTickAfterTheCurrentBatch() {
        // setup
        Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
        EventJobTicker ticker = ticker(clock);
        EventJobBatch interrupts = job -> {
            batches.incrementAndGet();
            Thread.currentThread().interrupt();
            return job;
        };

        // execution
        ticker.tick("Test job", running(clock), settings, interrupts, () -> failed.set(true));

        // verifications
        assertThat(batches).hasValue(1);
    }

    @Test
    void mongoDown_waitsForTheNextTick_withoutCountingAFailure() {
        // setup
        Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
        EventJobTicker ticker = ticker(clock);
        EventJobBatch mongoDown = job -> {
            throw new DataAccessResourceFailureException("no server");
        };

        // execution
        ticker.tick("Test job", running(clock), settings, mongoDown, () -> failed.set(true));

        // verifications
        verify(jobRepository, never()).save(any());
        assertThat(failed).isFalse();
    }

    @Test
    void anError_isCounted_andTheNextTickTriesAgain() {
        // setup
        Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
        EventJobTicker ticker = ticker(clock);

        // execution
        ticker.tick("Test job", running(clock), settings, failing(), () -> failed.set(true));

        // verifications
        EventJob saved = lastSaved();
        assertThat(saved.getFailures()).isEqualTo(1);
        assertThat(saved.getLastError()).isEqualTo("java.lang.IllegalStateException: bad batch");
        assertThat(saved.getStatus()).isEqualTo(EventJobStatus.RUNNING);
        assertThat(failed).isFalse();
    }

    @Test
    void maxFailuresInARow_setTheRunFailed_andCallOnFailed() {
        // setup
        Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
        EventJobTicker ticker = ticker(clock);
        EventJob job = running(clock);
        job.setFailures(2);

        // execution
        ticker.tick("Test job", job, settings, failing(), () -> failed.set(true));

        // verifications
        assertThat(lastSaved().getStatus()).isEqualTo(EventJobStatus.FAILED);
        assertThat(failed).isTrue();
    }

    @Test
    void aNewerCopyOnAnotherPod_stopsTheTick_withoutCountingAFailure() {
        // setup
        Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
        EventJobTicker ticker = ticker(clock);
        EventJobBatch conflict = job -> {
            throw new OptimisticLockingFailureException("newer copy");
        };

        // execution
        ticker.tick("Test job", running(clock), settings, conflict, () -> failed.set(true));

        // verifications
        verify(jobRepository, never()).save(any());
        assertThat(failed).isFalse();
    }

    private EventJobTicker ticker(Clock clock) {
        EventJobService jobService = new EventJobService(jobRepository, clock);
        return new EventJobTicker(jobService, shutdown, clock);
    }

    private static EventJob running(Clock clock) {
        Instant now = clock.instant();
        return EventJob.neverRun("test:job").startRun("run-1", now);
    }

    private static EventJobBatch failing() {
        return job -> {
            throw new IllegalStateException("bad batch");
        };
    }

    private EventJob lastSaved() {
        ArgumentCaptor<EventJob> saved = ArgumentCaptor.forClass(EventJob.class);
        verify(jobRepository, atLeastOnce()).save(saved.capture());
        return saved.getValue();
    }

    private static final class MovingClock extends Clock {

        private Instant now;

        private MovingClock(Instant start) {
            this.now = start;
        }

        void advance(Duration duration) {
            now = now.plus(duration);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }
}
