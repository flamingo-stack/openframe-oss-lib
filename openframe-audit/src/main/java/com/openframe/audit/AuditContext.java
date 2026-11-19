package com.openframe.audit;

import com.openframe.data.model.audit.AuditActor;
import com.openframe.data.model.audit.AuditRequestInfo;
import lombok.With;

public record AuditContext(@With AuditActor actor, AuditRequestInfo requestInfo, @With String parentEventId) {
}
