package com.openframe.client.service.auth;

import com.openframe.audit.ActionOutcome;
import com.openframe.audit.AuditOutcomeResolver;
import com.openframe.audit.AuditRecorder;
import com.openframe.data.document.audit.AuditOutcome;
import com.openframe.data.model.audit.AuditEntry;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Objects;

import static com.openframe.data.document.audit.AuditAction.DEVICE_AUTH_FAIL;

@Component
@RequiredArgsConstructor
public class AgentAuthAudit {

    private static final String AGENT_CLIENT_PREFIX = "agent_";

    private final AuditRecorder auditRecorder;
    private final AuditOutcomeResolver outcomeResolver;

    public void failed(String clientId, String grantType, RuntimeException failure) {
        ActionOutcome outcome = failure instanceof BadJwtException
                ? new ActionOutcome(AuditOutcome.REFUSED, failure.getMessage())
                : outcomeResolver.ofFailure(failure);
        String machineId = StringUtils.removeStart(clientId, AGENT_CLIENT_PREFIX);
        auditRecorder.recordOnce(AuditEntry.builder()
                .action(DEVICE_AUTH_FAIL)
                .outcome(outcome.outcome())
                .reason(outcome.reason())
                .targetId(machineId)
                .details(Map.of("request", "token", "grantType", grantType))
                .build(), grantType + ":" + Objects.requireNonNullElse(clientId, "-"));
    }
}
