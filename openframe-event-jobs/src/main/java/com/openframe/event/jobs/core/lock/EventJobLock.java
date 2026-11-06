package com.openframe.event.jobs.core.lock;

import net.javacrumbs.shedlock.core.DefaultLockingTaskExecutor;
import net.javacrumbs.shedlock.core.LockConfiguration;
import net.javacrumbs.shedlock.core.LockProvider;
import net.javacrumbs.shedlock.core.LockingTaskExecutor;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

// One pod at a time per job, through the service's ShedLock LockProvider; without the lock, the job does not run on this pod.
public class EventJobLock {

    private final LockingTaskExecutor lockingTaskExecutor;
    private final Clock clock;

    public EventJobLock(LockProvider lockProvider, Clock clock) {
        this.lockingTaskExecutor = new DefaultLockingTaskExecutor(lockProvider);
        this.clock = clock;
    }

    public void runExclusively(String jobId, Duration lockAtMostFor, Runnable job) {
        Instant now = clock.instant();
        LockConfiguration lock = new LockConfiguration(now, jobId, lockAtMostFor, Duration.ZERO);
        lockingTaskExecutor.executeWithLock(job, lock);
    }
}
