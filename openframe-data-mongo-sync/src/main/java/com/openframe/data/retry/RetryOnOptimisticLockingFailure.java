package com.openframe.data.retry;

import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Retryable;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
@Retryable(
        retryFor = OptimisticLockingFailureException.class,
        maxAttempts = 5,
        backoff = @Backoff(delay = 50, multiplier = 2, random = true)
)
public @interface RetryOnOptimisticLockingFailure {
}
