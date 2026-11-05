package com.openframe.data.document.audit;

public record AuditSource(String ip, String userAgent, String requestId, String sessionId) {
}
