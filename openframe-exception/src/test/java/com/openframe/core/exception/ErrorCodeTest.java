package com.openframe.core.exception;

import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ErrorCodeTest {

    private static final String EMAIL_PREFIX = "EMAIL_";
    private static final String MAILBOX_PREFIX = "MAILBOX_";
    private static final String HELD_EMAIL_PREFIX = "HELD_EMAIL_";

    @Test
    void valueOf_invalidCursor_codeStringAndBadRequestStatus() {
        // execution
        ApiErrorCode errorCode = ErrorCode.valueOf("INVALID_CURSOR");

        // verifications
        assertThat(errorCode.getCode()).isEqualTo("INVALID_CURSOR");
        assertThat(errorCode.getHttpStatus()).isEqualTo(400);
    }

    // The email-to-ticket codes belong to openframe-saas-lib (EmailToTicketErrorCode).
    @Test
    void values_emailToTicketPrefixes_noCodes() {
        // execution
        List<String> emailToTicketCodes = Arrays.stream(ErrorCode.values())
                .map(ErrorCode::name)
                .filter(ErrorCodeTest::isEmailToTicketName)
                .toList();

        // verifications
        assertThat(emailToTicketCodes).isEmpty();
    }

    private static boolean isEmailToTicketName(String name) {
        return name.startsWith(EMAIL_PREFIX)
                || name.startsWith(MAILBOX_PREFIX)
                || name.startsWith(HELD_EMAIL_PREFIX);
    }
}
