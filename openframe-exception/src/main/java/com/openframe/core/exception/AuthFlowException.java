package com.openframe.core.exception;

import lombok.Getter;

// Extends IllegalStateException so the catch blocks and 409 mappings written for that type keep working.
@Getter
public class AuthFlowException extends IllegalStateException {

    private final AuthErrorCode code;
    // Non-empty only when the message says more than the code's static copy can (an email, a provider reason) and should reach the user.
    private final String detail;

    public AuthFlowException(AuthErrorCode code, String message) {
        this(code, message, "");
    }

    private AuthFlowException(AuthErrorCode code, String message, String detail) {
        super(message);
        this.code = code;
        this.detail = detail;
    }

    public static AuthFlowException withDetail(AuthErrorCode code, String detail) {
        return new AuthFlowException(code, detail, detail);
    }

    public boolean hasDetail() {
        return !detail.isEmpty();
    }
}
