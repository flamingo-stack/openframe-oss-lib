package com.openframe.api.exception;

import com.openframe.api.dto.device.DeviceLogFilterInput;
import graphql.GraphQLError;
import graphql.execution.DataFetcherExceptionHandlerParameters;
import graphql.execution.DataFetcherExceptionHandlerResult;
import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class GraphQLExceptionHandlerTest {

    private final GraphQLExceptionHandler handler = new GraphQLExceptionHandler();

    @Test
    void reportsBeanValidationFailuresAsBadRequestsWithTheViolationMessage() {
        DeviceLogFilterInput tooManyTerms = DeviceLogFilterInput.builder()
                .contains(List.of("a", "b", "c", "d", "e", "f"))
                .build();
        ConstraintViolationException exception = violationsOf(tooManyTerms);

        GraphQLError error = handle(exception);

        assertThat(error.getExtensions()).containsEntry("code", "VALIDATION_ERROR").containsEntry("httpStatus", 400);
        // The handler prefixes the offending field, so the message itself should not repeat it
        assertThat(error.getMessage()).isEqualTo("contains: cannot hold more than 5 terms");
    }

    @Test
    void keepsReportingUnexpectedFailuresAsInternalErrors() {
        GraphQLError error = handle(new IllegalStateException("boom"));

        assertThat(error.getExtensions()).containsEntry("code", "VALIDATION_ERROR");

        GraphQLError unexpected = handle(new RuntimeException("boom"));
        assertThat(unexpected.getExtensions()).containsEntry("code", "INTERNAL_ERROR");
        assertThat(unexpected.getMessage()).doesNotContain("boom");
    }

    private GraphQLError handle(Throwable exception) {
        DataFetcherExceptionHandlerParameters parameters = DataFetcherExceptionHandlerParameters
                .newExceptionParameters()
                .exception(exception)
                .build();
        DataFetcherExceptionHandlerResult result = handler.handleException(parameters).join();
        return result.getErrors().get(0);
    }

    private static ConstraintViolationException violationsOf(DeviceLogFilterInput input) {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            Validator validator = factory.getValidator();
            return new ConstraintViolationException(validator.validate(input));
        }
    }
}
