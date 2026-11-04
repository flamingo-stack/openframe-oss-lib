package com.openframe.data.document.audit;

import com.github.f4b6a3.ulid.UlidCreator;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

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
    private static final int RETENTION_SECONDS = 7 * 24 * 60 * 60;

    @Id
    private String id;
    private int schemaVersion;
    @Indexed(name = "audit_events_ttl", expireAfterSeconds = RETENTION_SECONDS)
    private Instant occurredAt;
    private String action;
    private AuditOutcome outcome;
    private String reason;
    private AuditActorType actorType;
    private String actorId;
    private String actorName;
    private String actorEmail;
    private List<String> roleSnapshot;
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

    public static String newId() {
        return UlidCreator.getUlid().toString();
    }
}
