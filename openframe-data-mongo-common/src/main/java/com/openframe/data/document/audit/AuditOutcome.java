package com.openframe.data.document.audit;

public enum AuditOutcome {
    SUCCESS,
    FAILURE,
    REFUSED;

    private static final int REQUEST_TIMEOUT = 408;
    private static final int TOO_MANY_REQUESTS = 429;

    public static AuditOutcome ofStatus(Integer status) {
        if (status == null || status == REQUEST_TIMEOUT || status == TOO_MANY_REQUESTS) {
            return FAILURE;
        }
        if (status >= 200 && status < 300) {
            return SUCCESS;
        }
        return status >= 400 && status < 500 ? REFUSED : FAILURE;
    }
}
