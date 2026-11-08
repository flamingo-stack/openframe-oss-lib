package com.openframe.core.email;

public enum EmailVerdict {

    ALLOWED,
    BLOCKED_ADDRESS,
    BLOCKED_DOMAIN;

    public boolean isAllowed() {
        return this == ALLOWED;
    }
}
