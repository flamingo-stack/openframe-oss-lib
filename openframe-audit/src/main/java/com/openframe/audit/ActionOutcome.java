package com.openframe.audit;

import com.openframe.data.document.audit.AuditOutcome;

public record ActionOutcome(AuditOutcome outcome, String reason) {
}
