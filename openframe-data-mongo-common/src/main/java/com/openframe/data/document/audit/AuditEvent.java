package com.openframe.data.document.audit;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "audit_events")
public class AuditEvent {

    public static final int SCHEMA_VERSION = 1;
    public static final Duration RETENTION = Duration.ofDays(7);

    @Id
    private String id;
    private int schemaVersion;
    private Instant occurredAt;
    private String action;
    private AuditOutcome outcome;
    private String reason;
    private AuditActorType actorType;
    private String actorId;
    private String actorName;
    private String actorEmail;
    private List<String> actorRoles;
    private String onBehalfOfId;
    private String onBehalfOfName;
    private String approverId;
    private String approverName;
    private AuditOriginTool originTool;
    private String sourceIp;
    private String userAgent;
    private String sessionId;
    private String correlationId;
    private String parentEventId;
    private String tenantId;
    private String organizationId;
    private String deviceId;
    private AuditTargetType targetType;
    private String targetId;
    private String targetName;
    private Map<String, Object> details;
    private Map<String, AuditChange> changes;
}
