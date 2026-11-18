package com.openframe.core.exception;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ErrorCodeTest {

    private static final String EMAIL_PREFIX = "EMAIL_";
    private static final String MAILBOX_PREFIX = "MAILBOX_";

    @ParameterizedTest
    @CsvSource({
            "MAILBOX_NOT_FOUND, MAILBOX_NOT_FOUND, 404",
            "MAILBOX_EXISTS, MAILBOX_EXISTS, 409",
            "MAILBOX_REMOVED, MAILBOX_REMOVED, 409",
            "MAILBOX_NOT_PENDING, MAILBOX_NOT_PENDING, 409",
            "MAILBOX_PENDING, MAILBOX_PENDING, 409",
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
    void values_emailOrMailboxPrefix_exactlyTheNineCodes() {
        // execution
        List<String> emailToTicketCodes = Arrays.stream(ErrorCode.values())
                .map(ErrorCode::name)
                .filter(name -> name.startsWith(EMAIL_PREFIX) || name.startsWith(MAILBOX_PREFIX))
                .toList();

        // verifications
        assertThat(emailToTicketCodes).containsExactlyInAnyOrder(
                "MAILBOX_NOT_FOUND",
                "MAILBOX_EXISTS",
                "MAILBOX_REMOVED",
                "MAILBOX_NOT_PENDING",
                "MAILBOX_PENDING",
                "EMAIL_FORWARDING_TEST_IN_PROGRESS",
                "EMAIL_FORWARDING_TEST_NOT_PASSED",
                "EMAIL_FORWARDING_TEST_SEND_FAILED",
                "EMAIL_SEND_AS_ALREADY_SIGNED_IN");
    }
}
