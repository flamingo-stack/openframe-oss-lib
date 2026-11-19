package com.openframe.data.reactive.service;

import com.openframe.data.model.audit.AuditActor;
import com.openframe.data.model.audit.AuditRequestInfo;

public record AuditCaller(AuditActor actor, AuditRequestInfo requestInfo, String servedTenantId) {
}
