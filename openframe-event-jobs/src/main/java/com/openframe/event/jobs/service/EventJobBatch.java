package com.openframe.event.jobs.service;

import com.openframe.event.jobs.persistence.EventJob;

// One batch of a run: it does the work, saves the progress and returns the saved job, which is no longer RUNNING when done.
@FunctionalInterface
public interface EventJobBatch {

    EventJob next(EventJob job);
}
