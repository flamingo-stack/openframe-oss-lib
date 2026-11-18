package com.openframe.audit;

import com.openframe.data.model.audit.AuditEntry;
import com.openframe.gatewayauth.AccessDeniedObserver;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.servlet.HandlerMapping;

import static com.openframe.data.document.audit.AuditAction.AUTH_ACCESS_REFUSE;
import static com.openframe.data.document.audit.AuditOutcome.REFUSED;

@Component
@RequiredArgsConstructor
public class AccessDeniedAuditor implements AccessDeniedObserver {

    private final AuditRecorder auditRecorder;
    private final AuditedMethodRunner auditedMethodRunner;

    @Override
    public void onAccessDenied(AccessDeniedException denied) {
        if (auditedMethodRunner.alreadyRecorded(denied)) {
            return;
        }
        String endpoint = currentEndpoint();
        auditRecorder.recordOnce(AuditEntry.builder()
                .action(AUTH_ACCESS_REFUSE)
                .outcome(REFUSED)
                .reason(denied.getMessage())
                .targetId(endpoint)
                .build(), endpoint);
    }

    private static String currentEndpoint() {
        HttpServletRequest request =
                ((ServletRequestAttributes) RequestContextHolder.currentRequestAttributes()).getRequest();
        return request.getMethod() + " " + request.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE);
    }
}
