package com.openframe.audit;

import com.openframe.core.exception.ErrorCode;
import com.openframe.data.model.audit.AuditEntry;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import static com.openframe.data.document.audit.AuditAction.AUTH_ACCESS_REFUSE;
import static com.openframe.data.document.audit.AuditOutcome.REFUSED;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AccessDeniedAuditorTest {

    private final AccessDeniedException denied = new AccessDeniedException("Access Denied");

    @Mock private AuditRecorder auditRecorder;
    @Mock private AuditCapture auditCapture;
    @Captor private ArgumentCaptor<AuditEntry> entryCaptor;
    @InjectMocks private AccessDeniedAuditor auditor;

    @AfterEach
    void clearRequest() {
        RequestContextHolder.resetRequestAttributes();
    }

    @Test
    void onAccessDenied_noAuditedActionRecordedIt_recordsTheRefusalOncePerEndpoint() {
        when(auditCapture.alreadyRecorded(denied)).thenReturn(false);
        RequestContextHolder.setRequestAttributes(
                new ServletRequestAttributes(new MockHttpServletRequest("DELETE", "/api/users/user-1")));

        auditor.onAccessDenied(ErrorCode.FORBIDDEN, denied);

        verify(auditRecorder).recordOnce(entryCaptor.capture(), eq("DELETE /api/users/user-1"));
        assertThat(entryCaptor.getValue())
                .extracting(AuditEntry::getAction, AuditEntry::getOutcome, AuditEntry::getReason,
                        AuditEntry::getTargetId)
                .containsExactly(AUTH_ACCESS_REFUSE, REFUSED, "FORBIDDEN", "DELETE /api/users/user-1");
    }

    @Test
    void onAccessDenied_auditedActionRecordedIt_recordsNothing() {
        when(auditCapture.alreadyRecorded(denied)).thenReturn(true);

        auditor.onAccessDenied(ErrorCode.FORBIDDEN, denied);

        verify(auditRecorder, never()).recordOnce(any(), any());
    }
}
