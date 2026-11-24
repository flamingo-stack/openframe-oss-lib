package com.openframe.gateway.config.error;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.web.ErrorProperties;
import org.springframework.boot.autoconfigure.web.WebProperties;
import org.springframework.boot.webflux.autoconfigure.error.DefaultErrorWebExceptionHandler;
import org.springframework.boot.webflux.error.ErrorAttributes;
import org.springframework.context.ApplicationContext;
import org.springframework.http.HttpStatus;
import org.springframework.web.reactive.function.server.ServerRequest;
import org.springframework.web.reactive.function.server.ServerResponse;

@Slf4j
public class PathOnlyErrorWebExceptionHandler extends DefaultErrorWebExceptionHandler {

    public PathOnlyErrorWebExceptionHandler(ErrorAttributes errorAttributes, WebProperties.Resources resources,
                                            ErrorProperties errorProperties, ApplicationContext applicationContext) {
        super(errorAttributes, resources, errorProperties, applicationContext);
    }

    @Override
    protected void logError(ServerRequest request, ServerResponse response, Throwable throwable) {
        String logPrefix = request.exchange().getLogPrefix();
        if (log.isDebugEnabled()) {
            log.debug("{}Resolved [{}: {}] for HTTP {} {}", logPrefix, throwable.getClass().getSimpleName(),
                    throwable.getMessage(), request.method(), request.path());
        }
        if (HttpStatus.INTERNAL_SERVER_ERROR.equals(response.statusCode())) {
            Throwable failure = TracebackFreeFailure.of(throwable);
            log.error("{} 500 Server Error for HTTP {} \"{}\"", logPrefix, request.method(), request.path(),
                    failure);
        }
    }
}
