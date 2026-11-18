package com.openframe.audit;

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
import org.springframework.web.servlet.HandlerMapping;

import static com.openframe.data.document.audit.AuditAction.AUTH_ACCESS_REFUSE;
import static com.openframe.data.document.audit.AuditOutcome.REFUSED;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AccessDeniedAuditorTest {

    private static final String DENIAL = "Only the session's technician can post in a remote session chat";

    private final AccessDeniedException denied = new AccessDeniedException(DENIAL);

    @Mock private AuditRecorder auditRecorder;
    @Mock private AuditedMethodRunner auditedMethodRunner;
    @Captor private ArgumentCaptor<AuditEntry> entryCaptor;
    @InjectMocks private AccessDeniedAuditor auditor;

    @AfterEach
    void clearRequest() {
        RequestContextHolder.resetRequestAttributes();
    }

    @Test
    void onAccessDenied_noAuditedActionRecordedIt_recordsTheRefusalOncePerRouteWithItsTextAndWithoutItsIds() {
        when(auditedMethodRunner.alreadyRecorded(denied)).thenReturn(false);
        MockHttpServletRequest request = new MockHttpServletRequest("DELETE", "/api/users/user-1");
        request.setAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE, "/api/users/{id}");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));

        auditor.onAccessDenied(denied);

        verify(auditRecorder).recordOnce(entryCaptor.capture(), eq("DELETE /api/users/{id}"));
        assertThat(entryCaptor.getValue())
                .extracting(AuditEntry::getAction, AuditEntry::getOutcome, AuditEntry::getReason,
                        AuditEntry::getTargetId)
                .containsExactly(AUTH_ACCESS_REFUSE, REFUSED, DENIAL, "DELETE /api/users/{id}");
    }

    @Test
    void onAccessDenied_auditedActionRecordedIt_recordsNothing() {
        when(auditedMethodRunner.alreadyRecorded(denied)).thenReturn(true);

        auditor.onAccessDenied(denied);

        verifyNoInteractions(auditRecorder);
    }
}
