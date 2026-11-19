package com.openframe.publishing.api.spec;

public enum AggregateOrdering {

    // The document's @Version orders its events: a consumer skips an event older than the one it stored.
    VERSIONED,

    // No @Version needed: every event has version 0 and is applied, so the projections must be idempotent; no backfill.
    UNORDERED
}
