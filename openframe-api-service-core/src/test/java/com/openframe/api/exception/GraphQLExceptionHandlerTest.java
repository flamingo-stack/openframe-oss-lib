package com.openframe.api.exception;

import com.openframe.core.exception.ErrorCode;
import com.openframe.core.exception.NotFoundException;
import graphql.GraphQLError;
import graphql.execution.DataFetcherExceptionHandlerParameters;
import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.constraints.NotBlank;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class GraphQLExceptionHandlerTest {

    private final GraphQLExceptionHandler handler = new GraphQLExceptionHandler();

    @Test
    void constraintViolationIsAValidationErrorWithTheConstraintMessage() {
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        ConstraintViolationException exception = new ConstraintViolationException(validator.validate(new Input("")));

        GraphQLError error = handle(exception);

        assertEquals("name: name is required", error.getMessage());
        assertEquals(ErrorCode.VALIDATION_ERROR.getCode(), error.getExtensions().get("code"));
        assertEquals(400, error.getExtensions().get("httpStatus"));
    }

    @Test
    void illegalArgumentKeepsItsMessageAsValidationError() {
        GraphQLError error = handle(new IllegalArgumentException("Tag not found: t-1"));

        assertEquals("Tag not found: t-1", error.getMessage());
        assertEquals(ErrorCode.VALIDATION_ERROR.getCode(), error.getExtensions().get("code"));
    }

    @Test
    void typedNotFoundKeepsItsCode() {
        GraphQLError error = handle(new NotFoundException(ErrorCode.ORGANIZATION_NOT_FOUND, "Organization not found"));

        assertEquals("Organization not found", error.getMessage());
        assertEquals("ORGANIZATION_NOT_FOUND", error.getExtensions().get("code"));
        assertEquals(404, error.getExtensions().get("httpStatus"));
    }

    @Test
    void unexpectedRuntimeExceptionDoesNotLeakItsMessage() {
        GraphQLError error = handle(new RuntimeException("jdbc://secret-host is down"));

        assertEquals("An unexpected error occurred. Please try again later.", error.getMessage());
        assertEquals(ErrorCode.INTERNAL_ERROR.getCode(), error.getExtensions().get("code"));
    }

    private GraphQLError handle(Throwable exception) {
        DataFetcherExceptionHandlerParameters parameters = mock(DataFetcherExceptionHandlerParameters.class);
        when(parameters.getException()).thenReturn(exception);
        return handler.handleException(parameters).join().getErrors().getFirst();
    }

    private record Input(@NotBlank(message = "name is required") String name) {
    }
}
