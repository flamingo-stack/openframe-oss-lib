package com.openframe.audit;

@FunctionalInterface
public interface AuditedWork<R, E extends Throwable> {

    R run() throws E;
}
