package com.openframe.api.exception;

import com.openframe.core.exception.BaseException;
import com.openframe.core.exception.ConflictException;
import com.openframe.core.exception.ErrorCode;
import com.openframe.core.exception.NotFoundException;
import com.openframe.data.pinot.repository.exception.PinotQueryException;
import graphql.GraphQLError;
import graphql.execution.DataFetcherExceptionHandlerParameters;
import graphql.execution.DataFetcherExceptionHandlerResult;
import graphql.execution.SimpleDataFetcherExceptionHandler;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
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
        log.error("GraphQL error occurred", exception);

        GraphQLError error;

        if (exception instanceof PinotQueryException) {
            error = buildError("Query failed. Please try again later.", ErrorCode.PINOT_QUERY_ERROR);
        } else if (exception instanceof DataAccessException) {
            error = buildError("Database operation failed. Please try again later.", ErrorCode.DATABASE_ERROR);
        } else if (exception instanceof NotFoundException nfe) {
            error = buildError(nfe.getMessage(), nfe.getErrorCode());
        } else if (exception instanceof ConflictException ce) {
            error = buildError(ce.getMessage(), ce.getErrorCode());
        } else if (exception instanceof BaseException be) {
            error = buildError(be.getMessage(), be.getErrorCode());
        } else if (exception instanceof IllegalArgumentException || exception instanceof IllegalStateException) {
            error = buildError(exception.getMessage(), ErrorCode.VALIDATION_ERROR);
        } else if (exception instanceof RuntimeException) {
            error = buildError("An unexpected error occurred. Please try again later.", ErrorCode.INTERNAL_ERROR);
        } else {
            error = buildError("An unexpected error occurred. Please try again later.", ErrorCode.INTERNAL_ERROR);
        }

        return CompletableFuture.completedFuture(
                DataFetcherExceptionHandlerResult.newResult()
                        .error(error)
                        .build()
        );
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