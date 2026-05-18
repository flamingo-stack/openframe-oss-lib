package com.openframe.debezium.recovery;

/**
 * Rate-limits how often a single connector base name can be recreated by the
 * recovery manager. Absent by default (no recreation happens); SaaS supplies a
 * concrete bean for the shared cluster.
 */
public interface RecreationTracker {

    /**
     * @return true if a recreation for the given base name is currently allowed
     *         (i.e. limit for the rolling window has not been exceeded).
     */
    boolean canRecreate(String baseName);

    /**
     * Record that a recreation just happened. Counted against the rolling window.
     */
    void record(String baseName);
}
