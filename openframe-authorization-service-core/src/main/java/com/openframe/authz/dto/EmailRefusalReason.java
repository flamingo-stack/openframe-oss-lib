package com.openframe.authz.dto;

import com.openframe.core.email.EmailVerdict;

public enum EmailRefusalReason {

    TAKEN,
    BLOCKED_ADDRESS,
    BLOCKED_DOMAIN;

    /** {@code null} for an allowed address: the responses omit the reason then. */
    public static EmailRefusalReason of(EmailVerdict verdict) {
        return switch (verdict) {
            case ALLOWED -> null;
            case BLOCKED_ADDRESS -> BLOCKED_ADDRESS;
            case BLOCKED_DOMAIN -> BLOCKED_DOMAIN;
        };
    }
}
