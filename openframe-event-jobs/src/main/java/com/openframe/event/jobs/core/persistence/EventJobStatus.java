package com.openframe.event.jobs.core.persistence;

public enum EventJobStatus {
    RUNNING,
    DONE,
    FAILED,
    // A newer run of the same job started before this one finished.
    REPLACED
}
