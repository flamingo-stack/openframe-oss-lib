package com.openframe.api.exception;

import com.openframe.api.relay.InvalidRelayIdException;
import com.openframe.core.exception.BaseException;
import com.openframe.core.exception.ConflictException;
import com.openframe.core.exception.ErrorCode;
import com.openframe.core.exception.NotFoundException;
import com.openframe.data.loki.client.LokiQueryException;
import com.openframe.data.loki.client.LokiQueryRejectedException;
import com.openframe.data.pinot.repository.exception.PinotQueryException;
import com.openframe.security.authentication.AccessDeniedErrorCode;
import graphql.GraphQLError;
import graphql.execution.DataFetcherExceptionHandlerParameters;
import graphql.execution.DataFetcherExceptionHandlerResult;
import graphql.execution.SimpleDataFetcherExceptionHandler;
import jakarta.validation.ConstraintViolationException;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.CompletableFuture;

@Component
@Slf4j
public class GraphQLExceptionHandler extends SimpleDataFetcherExceptionHandler {

    @Override
    public CompletableFuture<DataFetcherExceptionHandlerResult> handleException(
            DataFetcherExceptionHandlerParameters handlerParameters) {

        Throwable exception = handlerParameters.getException();
        if (exception instanceof AccessDeniedException) {
            ErrorCode code = AccessDeniedErrorCode.forCurrentCaller();
            log.warn("GraphQL access denied ({}): {}", code.getCode(), exception.getMessage());
            return result(buildError(AccessDeniedErrorCode.MESSAGE, code));
        }
        if (exception instanceof InvalidRelayIdException) {
            String message = exception.getMessage();
            log.warn("GraphQL invalid id: {}", message);
            return result(buildError(message, ErrorCode.INVALID_ID));
        }
        log.error("GraphQL error occurred", exception);

        GraphQLError error;

        if (exception instanceof PinotQueryException) {
            error = buildError("Query failed. Please try again later.", ErrorCode.PINOT_QUERY_ERROR);
        } else if (exception instanceof LokiQueryRejectedException) {
            // Checked before LokiQueryException, its supertype: retrying this unchanged would hit the same limit
            error = buildError("This log search covers too much data. Narrow the time range, or filter by device or level.",
                    ErrorCode.LOKI_QUERY_REJECTED);
        } else if (exception instanceof LokiQueryException) {
            error = buildError("Device logs are temporarily unavailable. Please try again later.", ErrorCode.LOKI_QUERY_ERROR);
        } else if (exception instanceof DataAccessException) {
            error = buildError("Database operation failed. Please try again later.", ErrorCode.DATABASE_ERROR);
        } else if (exception instanceof NotFoundException nfe) {
            error = buildError(nfe.getMessage(), nfe.getErrorCode());
        } else if (exception instanceof ConflictException ce) {
            error = buildError(ce.getMessage(), ce.getErrorCode());
        } else if (exception instanceof BaseException be) {
            error = buildError(be.getMessage(), be.getErrorCode());
        } else if (exception instanceof ConstraintViolationException cve) {
            // Thrown by the @Validated data fetchers for an invalid argument; not an internal error.
            error = buildError(validationMessage(cve), ErrorCode.VALIDATION_ERROR);
        } else if (exception instanceof IllegalArgumentException || exception instanceof IllegalStateException) {
            error = buildError(exception.getMessage(), ErrorCode.VALIDATION_ERROR);
        } else if (exception instanceof RuntimeException) {
            error = buildError("An unexpected error occurred. Please try again later.", ErrorCode.INTERNAL_ERROR);
        } else {
            error = buildError("An unexpected error occurred. Please try again later.", ErrorCode.INTERNAL_ERROR);
        }

        return result(error);
    }

    private static CompletableFuture<DataFetcherExceptionHandlerResult> result(GraphQLError error) {
        return CompletableFuture.completedFuture(
                DataFetcherExceptionHandlerResult.newResult()
                        .error(error)
                        .build()
        );
    }

    private static String validationMessage(ConstraintViolationException exception) {
        return exception.getConstraintViolations().stream()
                .map(violation -> violation.getPropertyPath() + ": " + violation.getMessage())
                .sorted()
                .collect(Collectors.joining("; "));
    }

    private GraphQLError buildError(String message, ErrorCode errorCode) {
        return GraphQLError.newError()
                .message(message)
                .extensions(Map.of(
                        "code", errorCode.getCode(),
                        "httpStatus", errorCode.getHttpStatus(),
                        "timestamp", System.currentTimeMillis()
                ))
                .build();
    }
}
