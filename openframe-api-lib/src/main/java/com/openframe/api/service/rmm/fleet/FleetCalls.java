package com.openframe.api.service.rmm.fleet;

import java.util.Collection;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.Semaphore;
import java.util.function.Function;

public final class FleetCalls {

    // one Fleet serves every tenant and its agents (1 CPU on prod), so a page must not fire dozens of calls at once
    static final int MAX_IN_FLIGHT = 8;
    private static final Semaphore IN_FLIGHT = new Semaphore(MAX_IN_FLIGHT);

    private FleetCalls() {
    }

    // parallelStream would run these on the common pool, which is a single thread on a one-CPU pod
    public static <T, R> List<R> inParallel(Collection<T> keys, Function<T, R> call) {
        List<Future<R>> pending;
        try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
            pending = keys.stream()
                    .map(key -> executor.submit(() -> limited(call, key)))
                    .toList();
        }
        return pending.stream().map(FleetCalls::resultOf).toList();
    }

    private static <T, R> R limited(Function<T, R> call, T key) throws InterruptedException {
        IN_FLIGHT.acquire();
        try {
            return call.apply(key);
        } finally {
            IN_FLIGHT.release();
        }
    }

    private static <R> R resultOf(Future<R> future) {
        if (future.state() == Future.State.FAILED && future.exceptionNow() instanceof RuntimeException e) {
            throw e;
        }
        return future.resultNow();
    }
}
