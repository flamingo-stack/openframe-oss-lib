package com.openframe.api.exception;

import graphql.GraphQLError;
import graphql.execution.DataFetcherExceptionHandlerParameters;
import graphql.execution.DataFetcherExceptionHandlerResult;
import jakarta.validation.ConstraintViolationException;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;

class GraphQLExceptionHandlerTest {

    private final GraphQLExceptionHandler handler = new GraphQLExceptionHandler();

    @Test
    void constraintViolationSurfacesAsValidationError() {
        ConstraintViolationException violation =
                new ConstraintViolationException("version must start with a letter or digit", Set.of());

        GraphQLError error = handle(violation);

        assertEquals("version must start with a letter or digit", error.getMessage());
        assertEquals("VALIDATION_ERROR", error.getExtensions().get("code"));
        assertEquals(400, error.getExtensions().get("httpStatus"));
    }

    @Test
    void illegalArgumentSurfacesAsValidationError() {
        IllegalArgumentException rejection = new IllegalArgumentException("BREW packages require a MAC_OS machine");

        GraphQLError error = handle(rejection);

        assertEquals("BREW packages require a MAC_OS machine", error.getMessage());
        assertEquals("VALIDATION_ERROR", error.getExtensions().get("code"));
    }

    private GraphQLError handle(Throwable exception) {
        DataFetcherExceptionHandlerParameters parameters = DataFetcherExceptionHandlerParameters
                .newExceptionParameters()
                .exception(exception)
                .build();
        DataFetcherExceptionHandlerResult result = handler.handleException(parameters).join();
        return result.getErrors().getFirst();
    }
}
