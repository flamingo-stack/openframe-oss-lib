package com.openframe.event.jobs.core.service;

import com.openframe.event.jobs.core.persistence.EventJob;

// One batch of a run: it does the work, saves the progress and returns the saved job, which is no longer RUNNING when done.
@FunctionalInterface
public interface EventJobBatch {

    EventJob next(EventJob job);
}
