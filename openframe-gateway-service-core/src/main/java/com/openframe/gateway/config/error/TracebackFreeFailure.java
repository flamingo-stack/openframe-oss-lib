package com.openframe.gateway.config.error;

import reactor.core.Exceptions;

import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.Set;

public final class TracebackFreeFailure extends RuntimeException {

    private final String description;

    private TracebackFreeFailure(Throwable source, Throwable cause) {
        super(source.getMessage(), cause);
        this.description = source.toString();
        setStackTrace(source.getStackTrace());
    }

    public static Throwable of(Throwable source) {
        Set<Throwable> seen = Collections.newSetFromMap(new IdentityHashMap<>());
        return copy(source, seen);
    }

    @Override
    public String toString() {
        return description;
    }

    @Override
    public synchronized Throwable fillInStackTrace() {
        return this;
    }

    private static Throwable copy(Throwable source, Set<Throwable> seen) {
        if (source == null || !seen.add(source)) {
            return null;
        }
        Throwable cause = copy(source.getCause(), seen);
        TracebackFreeFailure failure = new TracebackFreeFailure(source, cause);
        for (Throwable suppressed : source.getSuppressed()) {
            if (!Exceptions.isTraceback(suppressed)) {
                Throwable suppressedCopy = copy(suppressed, seen);
                addIfPresent(failure, suppressedCopy);
            }
        }
        return failure;
    }

    private static void addIfPresent(Throwable failure, Throwable suppressed) {
        if (suppressed != null) {
            failure.addSuppressed(suppressed);
        }
    }
}
