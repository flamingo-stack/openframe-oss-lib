package com.openframe.test.helpers.ai;

import java.util.UUID;

/**
 * Short unique token embedded in every artifact a run creates (file paths, file contents, ticket
 * titles, dialog titles). Makes cases parallel-safe, keeps a stale artifact from passing a broken
 * test, and makes cleanup unambiguous.
 */
public final class RunId {

    private final String value;

    private RunId(String value) {
        this.value = value;
    }

    public static RunId next() {
        return new RunId("e2e-" + UUID.randomUUID().toString().replace("-", "").substring(0, 6));
    }

    public String value() {
        return value;
    }

    @Override
    public String toString() {
        return value;
    }
}
