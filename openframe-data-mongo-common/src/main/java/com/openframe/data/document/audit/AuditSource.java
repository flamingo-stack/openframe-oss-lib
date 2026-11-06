package com.openframe.data.document.audit;

import lombok.With;

import java.util.function.UnaryOperator;

import static com.openframe.data.document.audit.AuditRequestContext.CLIENT_IP_HEADER;
import static com.openframe.data.document.audit.AuditRequestContext.REQUEST_ID_HEADER;
import static com.openframe.data.document.audit.AuditRequestContext.USER_AGENT_HEADER;

public record AuditSource(String ip, String userAgent, String requestId, @With String sessionId) {

    public static AuditSource fromHeaders(UnaryOperator<String> header, String sessionId) {
        return new AuditSource(header.apply(CLIENT_IP_HEADER), header.apply(USER_AGENT_HEADER),
                header.apply(REQUEST_ID_HEADER), sessionId);
    }
}
