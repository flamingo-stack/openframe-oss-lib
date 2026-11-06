package com.openframe.data.reactive.service;

import com.openframe.data.document.audit.AuditActor;
import com.openframe.data.document.audit.AuditSource;

public record AuditCaller(AuditActor actor, AuditSource source, String servedTenantId) {
}
