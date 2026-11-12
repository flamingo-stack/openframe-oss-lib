package com.openframe.data.model.audit;

import com.openframe.data.document.audit.AuditAction;
import com.openframe.data.document.audit.AuditChange;
import com.openframe.data.document.audit.AuditOriginTool;
import com.openframe.data.document.audit.AuditOutcome;
import com.openframe.data.document.audit.AuditTargetType;
import lombok.Builder;
import lombok.Getter;
import lombok.ToString;

import java.util.Map;

@Getter
@ToString
@Builder(toBuilder = true)
public class AuditEntry {
    private final String id;
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
