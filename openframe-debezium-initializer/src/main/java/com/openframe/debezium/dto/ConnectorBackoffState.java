package com.openframe.debezium.dto;

import java.time.Instant;

public class ConnectorBackoffState {

    private int consecutiveFailures;
    private Instant nextEligibleRestart;

    public ConnectorBackoffState() {
        this.consecutiveFailures = 0;
        this.nextEligibleRestart = Instant.MIN;
    }

    public void recordFailure(long backoffMs) {
        this.consecutiveFailures++;
        this.nextEligibleRestart = Instant.now().plusMillis(backoffMs);
    }

    public boolean isEligibleForRestart() {
        return Instant.now().isAfter(nextEligibleRestart);
    }

    public int getConsecutiveFailures() {
        return consecutiveFailures;
    }

    public Instant getNextEligibleRestart() {
        return nextEligibleRestart;
    }
}
