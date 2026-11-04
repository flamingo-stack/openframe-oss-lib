package com.openframe.data.document.audit;

import lombok.Builder;
import lombok.Getter;

import java.util.Map;

@Getter
@Builder
public class AuditEntry {
    private final AuditAction action;
    private final AuditOutcome outcome;
    private final String reason;
    private final AuditTargetType targetType;
    private final String targetId;
    private final String targetName;
    private final String tenantId;
    private final String organizationId;
    private final String deviceId;
    private final AuditOriginTool originTool;
    private final String parentEventId;
    private final Map<String, Object> details;
    private final Map<String, AuditChange> changes;
}
