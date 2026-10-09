package com.openframe.core.async;

import io.micrometer.context.ContextExecutorService;
import io.micrometer.context.ContextSnapshot;
import io.micrometer.context.ContextSnapshotFactory;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Supplier;

public final class TracedExecutorFactory {

    private static final ContextSnapshotFactory SNAPSHOT_FACTORY = ContextSnapshotFactory.builder().build();

    private TracedExecutorFactory() {
    }

    // A fresh thread starts with empty thread locals, so without this wrapper traceId/spanId
    // and the observation scope are lost the moment work crosses an async boundary.
    public static ExecutorService newVirtualThreadPerTaskExecutor() {
        ExecutorService delegate = Executors.newVirtualThreadPerTaskExecutor();
        return trace(delegate);
    }

    public static ExecutorService trace(ExecutorService delegate) {
        Supplier<ContextSnapshot> snapshotSupplier = SNAPSHOT_FACTORY::captureAll;
        return ContextExecutorService.wrap(delegate, snapshotSupplier);
    }
}
