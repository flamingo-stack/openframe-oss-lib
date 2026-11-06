package com.openframe.event.jobs.core.service;

import com.openframe.event.jobs.core.persistence.EventJobStatus;

// Saves the failures EventJobTicker counts; a save throws OptimisticLockingFailureException when another copy is newer.
public interface EventJobProgressStore<J extends EventJobProgress> {

    J recordFailure(J job, String error);

    J finishRun(J job, EventJobStatus status);
}
