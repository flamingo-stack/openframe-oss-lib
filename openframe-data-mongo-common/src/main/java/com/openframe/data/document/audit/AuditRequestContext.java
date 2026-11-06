package com.openframe.data.document.audit;

import lombok.experimental.UtilityClass;

@UtilityClass
public class AuditRequestContext {

    public static final String CLIENT_IP_HEADER = "X-Client-Ip";
    public static final String REQUEST_ID_HEADER = "X-Request-Id";
    public static final String USER_AGENT_HEADER = "User-Agent";
    public static final String SESSION_CLAIM = "sid";
    public static final String SESSION_ATTRIBUTE = "openframe.audit.session";
    public static final String ACTOR_ATTRIBUTE = "openframe.audit.actor";
}
