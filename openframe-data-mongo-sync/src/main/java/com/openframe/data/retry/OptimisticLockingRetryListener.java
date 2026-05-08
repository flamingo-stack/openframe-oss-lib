package com.openframe.data.retry;

import lombok.extern.slf4j.Slf4j;
import org.springframework.retry.RetryCallback;
import org.springframework.retry.RetryContext;
import org.springframework.retry.RetryListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component("optimisticLockingRetryListener")
public class OptimisticLockingRetryListener implements RetryListener {

    private static final String METHOD_NAME_KEY = "context.name";

    @Override
    public <T, E extends Throwable> void onError(RetryContext context,
                                                 RetryCallback<T, E> callback,
                                                 Throwable throwable) {
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
        } else {
            log.error("OLE retry exhausted on {} after {} retry(ies), bubbling: {}",
                    method, attempts, throwable.toString());
        }
    }
}
