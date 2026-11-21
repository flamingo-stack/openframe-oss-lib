package com.openframe.client.service.auth;

import com.openframe.audit.ActionOutcome;
import com.openframe.audit.AuditOutcomeResolver;
import com.openframe.audit.AuditRecorder;
import com.openframe.data.document.audit.AuditOutcome;
import com.openframe.data.model.audit.AuditEntry;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;

import static com.openframe.data.document.audit.AuditAction.DEVICE_AUTH_FAIL;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AgentAuthAuditTest {

    @Mock private AuditRecorder auditRecorder;
    @Mock private AuditOutcomeResolver outcomeResolver;
    @InjectMocks private AgentAuthAudit audit;

    @Test
    void failed_agentClient_recordsTheOutcomeAgainstItsMachineOncePerClient() {
        IllegalArgumentException failure = new IllegalArgumentException("Invalid client secret");
        when(outcomeResolver.ofFailure(failure)).thenReturn(new ActionOutcome(AuditOutcome.REFUSED, "Invalid client secret"));

        audit.failed("agent_mach-7", "client_credentials", failure);

        ArgumentCaptor<AuditEntry> entry = ArgumentCaptor.forClass(AuditEntry.class);
        verify(auditRecorder).recordOnce(entry.capture(), eq("client_credentials:agent_mach-7"));
        assertThat(entry.getValue())
                .extracting(AuditEntry::getAction, AuditEntry::getOutcome, AuditEntry::getReason,
                        AuditEntry::getTargetId, AuditEntry::getDetails)
                .containsExactly(DEVICE_AUTH_FAIL, AuditOutcome.REFUSED, "Invalid client secret", "mach-7",
                        Map.of("grantType", "client_credentials"));
    }

    @Test
    void failed_noClient_recordsWithoutAMachineOncePerGrant() {
        IllegalArgumentException failure = new IllegalArgumentException("Malformed token");
        when(outcomeResolver.ofFailure(failure)).thenReturn(new ActionOutcome(AuditOutcome.REFUSED, "Malformed token"));

        audit.failed(null, "refresh_token", failure);

        ArgumentCaptor<AuditEntry> entry = ArgumentCaptor.forClass(AuditEntry.class);
        verify(auditRecorder).recordOnce(entry.capture(), eq("refresh_token:-"));
        assertThat(entry.getValue().getTargetId()).isNull();
    }
}
