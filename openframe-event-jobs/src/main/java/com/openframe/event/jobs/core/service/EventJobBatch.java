package com.openframe.event.jobs.core.service;

// One batch of a run: it does the work, saves the progress and returns the saved job, which is no longer RUNNING when done.
@FunctionalInterface
public interface EventJobBatch<J extends EventJobProgress> {

    J next(J job);
}
