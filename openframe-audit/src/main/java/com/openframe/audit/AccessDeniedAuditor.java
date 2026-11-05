package com.openframe.audit;

import com.openframe.core.exception.ErrorCode;
import com.openframe.data.document.audit.AuditEntry;
import com.openframe.gatewayauth.AccessDeniedObserver;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import static com.openframe.data.document.audit.AuditAction.AUTH_ACCESS_DENY;
import static com.openframe.data.document.audit.AuditOutcome.REFUSED;

@Component
@RequiredArgsConstructor
public class AccessDeniedAuditor implements AccessDeniedObserver {

    private final AuditRecorder auditRecorder;

    @Override
    public void onAccessDenied(ErrorCode code) {
        auditRecorder.record(AuditEntry.builder()
                .action(AUTH_ACCESS_DENY)
                .outcome(REFUSED)
                .reason(code.getCode())
                .targetId(requestPath())
                .build());
    }

    private static String requestPath() {
        return RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes
                ? attributes.getRequest().getMethod() + " " + attributes.getRequest().getRequestURI()
                : null;
    }
}
