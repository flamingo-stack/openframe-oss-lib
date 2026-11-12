package com.openframe.audit;

import com.openframe.core.exception.ErrorCode;
import com.openframe.data.model.audit.AuditEntry;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

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
    @Captor private ArgumentCaptor<AuditEntry> entryCaptor;
    @InjectMocks private AccessDeniedAuditor auditor;

    @Test
    void onAccessDenied_noAuditedActionRecordedIt_recordsTheRefusalOncePerEndpoint() {
        when(auditRecorder.captured(denied)).thenReturn(false);
        when(auditRecorder.currentEndpoint()).thenReturn("DELETE /api/users/user-1");

        auditor.onAccessDenied(ErrorCode.FORBIDDEN, denied);

        verify(auditRecorder).recordOnce(entryCaptor.capture(), eq("DELETE /api/users/user-1"));
        assertThat(entryCaptor.getValue())
                .extracting(AuditEntry::getAction, AuditEntry::getOutcome, AuditEntry::getReason,
                        AuditEntry::getTargetId)
                .containsExactly(AUTH_ACCESS_REFUSE, REFUSED, "FORBIDDEN", "DELETE /api/users/user-1");
    }

    @Test
    void onAccessDenied_auditedActionRecordedIt_recordsNothing() {
        when(auditRecorder.captured(denied)).thenReturn(true);

        auditor.onAccessDenied(ErrorCode.FORBIDDEN, denied);

        verify(auditRecorder, never()).recordOnce(any(), any());
    }

    @Test
    void onAccessDenied_noCurrentRequest_recordsTheRefusalWithoutTargetUnderPlaceholderKey() {
        when(auditRecorder.captured(denied)).thenReturn(false);
        when(auditRecorder.currentEndpoint()).thenReturn(null);

        auditor.onAccessDenied(ErrorCode.FORBIDDEN, denied);

        verify(auditRecorder).recordOnce(entryCaptor.capture(), eq("-"));
        assertThat(entryCaptor.getValue().getTargetId()).isNull();
    }
}
