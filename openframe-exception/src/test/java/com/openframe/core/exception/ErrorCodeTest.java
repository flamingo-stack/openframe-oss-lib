package com.openframe.core.exception;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ErrorCodeTest {

    private static final String EMAIL_PREFIX = "EMAIL_";

    @ParameterizedTest
    @CsvSource({
            "EMAIL_MAILBOX_NOT_FOUND, EMAIL_MAILBOX_NOT_FOUND, 404",
            "EMAIL_MAILBOX_EXISTS, EMAIL_MAILBOX_EXISTS, 409",
            "EMAIL_MAILBOX_REMOVED, EMAIL_MAILBOX_REMOVED, 409",
            "EMAIL_MAILBOX_NOT_PENDING, EMAIL_MAILBOX_NOT_PENDING, 409",
            "EMAIL_MAILBOX_PENDING, EMAIL_MAILBOX_PENDING, 409",
            "EMAIL_FORWARDING_TEST_IN_PROGRESS, EMAIL_FORWARDING_TEST_IN_PROGRESS, 409",
            "EMAIL_FORWARDING_TEST_NOT_PASSED, EMAIL_FORWARDING_TEST_NOT_PASSED, 409",
            "EMAIL_FORWARDING_TEST_SEND_FAILED, EMAIL_FORWARDING_TEST_SEND_FAILED, 502",
            "EMAIL_SEND_AS_ALREADY_SIGNED_IN, EMAIL_SEND_AS_ALREADY_SIGNED_IN, 409"
    })
    void valueOf_emailToTicketCode_codeStringAndHttpStatus(String name, String code, int httpStatus) {
        // execution
        ErrorCode errorCode = ErrorCode.valueOf(name);

        // verifications
        assertThat(errorCode.getCode()).isEqualTo(code);
        assertThat(errorCode.getHttpStatus()).isEqualTo(httpStatus);
    }

    @Test
    void values_emailPrefix_exactlyTheNineCodes() {
        // execution
        List<String> emailCodes = Arrays.stream(ErrorCode.values())
                .map(ErrorCode::name)
                .filter(name -> name.startsWith(EMAIL_PREFIX))
                .toList();

        // verifications
        assertThat(emailCodes).containsExactlyInAnyOrder(
                "EMAIL_MAILBOX_NOT_FOUND",
                "EMAIL_MAILBOX_EXISTS",
                "EMAIL_MAILBOX_REMOVED",
                "EMAIL_MAILBOX_NOT_PENDING",
                "EMAIL_MAILBOX_PENDING",
                "EMAIL_FORWARDING_TEST_IN_PROGRESS",
                "EMAIL_FORWARDING_TEST_NOT_PASSED",
                "EMAIL_FORWARDING_TEST_SEND_FAILED",
                "EMAIL_SEND_AS_ALREADY_SIGNED_IN");
    }
}
