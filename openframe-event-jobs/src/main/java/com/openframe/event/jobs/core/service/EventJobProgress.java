package com.openframe.event.jobs.core.service;

import com.openframe.event.jobs.core.persistence.EventJobStatus;

// What EventJobTicker reads from a job's progress document: event_jobs for the runs, projection_tasks for the tasks.
public interface EventJobProgress {

    EventJobStatus getStatus();

    String getRunId();

    String getLastId();

    int getFailures();
}
