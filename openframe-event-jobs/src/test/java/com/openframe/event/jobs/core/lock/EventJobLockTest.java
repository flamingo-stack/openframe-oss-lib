package com.openframe.event.jobs.core.lock;

import net.javacrumbs.shedlock.core.LockConfiguration;
import net.javacrumbs.shedlock.core.LockProvider;
import net.javacrumbs.shedlock.core.SimpleLock;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class EventJobLockTest {

    private static final Instant NOW = Instant.parse("2026-10-21T10:00:00Z");

    private final LockProvider lockProvider = mock(LockProvider.class);
    private final SimpleLock simpleLock = mock(SimpleLock.class);
    private final EventJobLock jobLock = new EventJobLock(lockProvider, Clock.fixed(NOW, ZoneOffset.UTC));

    @Test
    void theJob_runsUnderALockNamedAfterIt_andTheLockIsReleased() {
        // setup
        when(lockProvider.lock(any())).thenReturn(Optional.of(simpleLock));
        AtomicBoolean ran = new AtomicBoolean();

        // execution
        jobLock.runExclusively("backfill:organizations", Duration.ofMinutes(2), () -> ran.set(true));

        // verifications
        ArgumentCaptor<LockConfiguration> lock = ArgumentCaptor.forClass(LockConfiguration.class);
        verify(lockProvider).lock(lock.capture());
        assertThat(lock.getValue().getName()).isEqualTo("backfill:organizations");
        assertThat(lock.getValue().getLockAtMostUntil()).isEqualTo(NOW.plus(Duration.ofMinutes(2)));
        assertThat(ran).isTrue();
        verify(simpleLock).unlock();
    }

    @Test
    void withoutTheLock_theJobDoesNotRun() {
        // setup
        when(lockProvider.lock(any())).thenReturn(Optional.empty());
        AtomicBoolean ran = new AtomicBoolean();

        // execution
        jobLock.runExclusively("backfill:organizations", Duration.ofMinutes(2), () -> ran.set(true));

        // verifications
        assertThat(ran).isFalse();
    }
}
