package com.openframe.data.retry;

import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.dao.TransientDataAccessResourceException;
import org.springframework.retry.RetryCallback;
import org.springframework.retry.RetryContext;
import org.springframework.retry.RetryListener;
import org.springframework.stereotype.Component;

// Logs only what it retries, conflicts and failovers: "retry exhausted" must mean a lost background update, never another exception.
@Slf4j
@Component("optimisticLockingRetryListener")
public class OptimisticLockingRetryListener implements RetryListener {

    private static final String METHOD_NAME_KEY = "context.name";
    // Fixed text for log alerts; keep it stable when the message changes.
    static final String UPDATE_NOT_SAVED_MARKER = "OPTIMISTIC_LOCK_UPDATE_NOT_SAVED";

    @Override
    public <T, E extends Throwable> void onError(RetryContext context,
                                                 RetryCallback<T, E> callback,
                                                 Throwable throwable) {
        if (!isRetried(throwable)) {
            return;
        }
        int attempt = context.getRetryCount();
        String method = String.valueOf(context.getAttribute(METHOD_NAME_KEY));
        log.warn("OLE retry attempt {} on {} failed: {}", attempt, method, throwable.toString());
    }

    @Override
    public <T, E extends Throwable> void close(RetryContext context,
                                                RetryCallback<T, E> callback,
                                                Throwable throwable) {
        int attempts = context.getRetryCount();
        if (attempts == 0) {
            return;
        }
        String method = String.valueOf(context.getAttribute(METHOD_NAME_KEY));
        if (throwable == null) {
            log.info("OLE retry succeeded on {} after {} retry(ies)", method, attempts);
        } else if (isRetried(throwable)) {
            log.error("{} OLE retry exhausted on {} after {} retry(ies), update not saved: {}",
                    UPDATE_NOT_SAVED_MARKER, method, attempts, throwable.toString());
        }
    }

    private static boolean isRetried(Throwable throwable) {
        return throwable instanceof OptimisticLockingFailureException
            || throwable instanceof TransientDataAccessResourceException;
    }
}
