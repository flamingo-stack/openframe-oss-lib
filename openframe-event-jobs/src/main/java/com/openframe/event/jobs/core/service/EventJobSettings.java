package com.openframe.event.jobs.core.service;

import java.time.Duration;

// The settings every job's tick uses; the backfill and reconciliation properties both have them.
public interface EventJobSettings {

    Duration getLockAtMostFor();

    Duration getPause();

    int getMaxFailures();
}
