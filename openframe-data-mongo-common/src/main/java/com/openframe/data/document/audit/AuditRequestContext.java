package com.openframe.data.document.audit;

public final class AuditRequestContext {

    public static final String CLIENT_IP_HEADER = "X-Client-Ip";
    public static final String REQUEST_ID_HEADER = "X-Request-Id";
    public static final String SESSION_CLAIM = "sid";

    private AuditRequestContext() {
    }
}
