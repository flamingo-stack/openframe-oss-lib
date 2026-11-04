package com.openframe.data.document.audit;

public enum AuditKind {
    CHANGE,
    SENSITIVE_READ,
    LOGIN,
    SESSION,
    DENIAL,
    FAILURE
}
