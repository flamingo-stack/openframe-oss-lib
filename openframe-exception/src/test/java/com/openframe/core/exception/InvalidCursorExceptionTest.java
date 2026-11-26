package com.openframe.core.exception;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import static org.assertj.core.api.Assertions.assertThat;

class InvalidCursorExceptionTest {

    private static final String INVALID_CURSOR = "INVALID_CURSOR";
    private static final String MESSAGE = "Invalid cursor";

    @Test
    void new_noCause_badRequestWithTheInvalidCursorCodeAndAFixedMessage() {
        // execution
        InvalidCursorException exception = new InvalidCursorException();

        // verifications
        assertThat(exception)
                .isInstanceOf(BadRequestException.class)
                .hasMessage(MESSAGE)
                .hasNoCause();
        assertThat(exception.getErrorCode().getCode()).isEqualTo(INVALID_CURSOR);
        assertThat(exception.getHttpStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void new_cause_sameCodeAndMessageWithTheCauseKept() {
        // setup
        NumberFormatException cause = new NumberFormatException("For input string: \"x\"");

        // execution
        InvalidCursorException exception = new InvalidCursorException(cause);

        // verifications
        assertThat(exception)
                .hasMessage(MESSAGE)
                .hasCause(cause);
        assertThat(exception.getErrorCode().getCode()).isEqualTo(INVALID_CURSOR);
        assertThat(exception.getHttpStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
    }
}
