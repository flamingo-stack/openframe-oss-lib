package com.openframe.audit;

import com.openframe.core.exception.ErrorCode;
import com.openframe.data.model.audit.AuditEntry;
import com.openframe.gatewayauth.AccessDeniedObserver;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

import java.util.Objects;

import static com.openframe.data.document.audit.AuditAction.AUTH_ACCESS_REFUSE;
import static com.openframe.data.document.audit.AuditOutcome.REFUSED;

@Component
@RequiredArgsConstructor
public class AccessDeniedAuditor implements AccessDeniedObserver {

    private final AuditRecorder auditRecorder;

    @Override
    public void onAccessDenied(ErrorCode code, AccessDeniedException denied) {
        if (auditRecorder.captured(denied)) {
            return;
        }
        String path = auditRecorder.currentEndpoint();
        auditRecorder.recordOnce(AuditEntry.builder()
                .action(AUTH_ACCESS_REFUSE)
                .outcome(REFUSED)
                .reason(code.getCode())
                .targetId(path)
                .build(), Objects.requireNonNullElse(path, "-"));
    }
}
