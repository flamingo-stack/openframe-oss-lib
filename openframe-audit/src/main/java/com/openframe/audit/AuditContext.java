package com.openframe.audit;

import com.openframe.data.document.audit.AuditActor;
import com.openframe.data.document.audit.AuditSource;

public record AuditContext(AuditActor actor, AuditSource source) {
}
