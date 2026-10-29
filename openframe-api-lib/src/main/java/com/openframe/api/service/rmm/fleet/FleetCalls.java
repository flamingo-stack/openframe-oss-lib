package com.openframe.api.service.rmm.fleet;

import java.util.Collection;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.function.Function;

public final class FleetCalls {

    private FleetCalls() {
    }

    // parallelStream would run these on the common pool, which is a single thread on a one-CPU pod
    public static <T, R> List<R> inParallel(Collection<T> keys, Function<T, R> call) {
        List<Future<R>> pending;
        try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
            pending = keys.stream()
                    .map(key -> executor.submit(() -> call.apply(key)))
                    .toList();
        }
        return pending.stream().map(FleetCalls::resultOf).toList();
    }

    private static <R> R resultOf(Future<R> future) {
        if (future.state() == Future.State.FAILED && future.exceptionNow() instanceof RuntimeException e) {
            throw e;
        }
        return future.resultNow();
    }
}
