package com.openframe.data.model.audit;

import lombok.With;

import java.util.function.UnaryOperator;

import static com.openframe.data.model.audit.AuditConstants.CLIENT_IP_HEADER;
import static com.openframe.data.model.audit.AuditConstants.REQUEST_ID_HEADER;
import static com.openframe.data.model.audit.AuditConstants.USER_AGENT_HEADER;

public record AuditRequestInfo(String ip, String userAgent, String requestId, @With String sessionId) {

    public static AuditRequestInfo fromHeaders(UnaryOperator<String> header, String sessionId) {
        return new AuditRequestInfo(header.apply(CLIENT_IP_HEADER), header.apply(USER_AGENT_HEADER),
                header.apply(REQUEST_ID_HEADER), sessionId);
    }
}
