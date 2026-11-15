package com.openframe.audit;

import com.openframe.core.exception.ErrorCode;
import com.openframe.data.model.audit.AuditEntry;
import com.openframe.gatewayauth.AccessDeniedObserver;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import static com.openframe.data.document.audit.AuditAction.AUTH_ACCESS_REFUSE;
import static com.openframe.data.document.audit.AuditOutcome.REFUSED;

@Component
@RequiredArgsConstructor
public class AccessDeniedAuditor implements AccessDeniedObserver {

    private final AuditRecorder auditRecorder;
    private final AuditCapture auditCapture;

    @Override
    public void onAccessDenied(ErrorCode code, AccessDeniedException denied) {
        if (auditCapture.alreadyRecorded(denied)) {
            return;
        }
        String path = currentEndpoint();
        auditRecorder.recordOnce(AuditEntry.builder()
                .action(AUTH_ACCESS_REFUSE)
                .outcome(REFUSED)
                .reason(code.getCode())
                .targetId(path)
                .build(), path);
    }

    private static String currentEndpoint() {
        HttpServletRequest request =
                ((ServletRequestAttributes) RequestContextHolder.currentRequestAttributes()).getRequest();
        return request.getMethod() + " " + request.getRequestURI();
    }
}
