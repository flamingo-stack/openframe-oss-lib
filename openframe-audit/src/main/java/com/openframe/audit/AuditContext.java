package com.openframe.audit;

import com.openframe.data.document.audit.AuditActor;
import com.openframe.data.document.audit.AuditSource;
import lombok.With;

public record AuditContext(AuditActor actor, AuditSource source, @With String parentEventId) {
}
