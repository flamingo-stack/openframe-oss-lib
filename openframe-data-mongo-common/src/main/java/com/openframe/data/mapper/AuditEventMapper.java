package com.openframe.data.mapper;

import com.github.f4b6a3.ulid.UlidCreator;
import com.openframe.data.document.audit.AuditEvent;
import com.openframe.data.document.audit.AuditTargetType;
import com.openframe.data.model.audit.AuditActor;
import com.openframe.data.model.audit.AuditEntry;
import com.openframe.data.model.audit.AuditRequestInfo;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.ReportingPolicy;

import java.time.Instant;
import java.util.Objects;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface AuditEventMapper {

    @Mapping(target = "id", expression = "java(idOf(entry))")
    @Mapping(target = "parentEventId", expression = "java(parentEventIdOf(entry, parentEventId))")
    @Mapping(target = "schemaVersion", expression = "java(AuditEvent.SCHEMA_VERSION)")
    @Mapping(target = "action", source = "entry.action.name")
    @Mapping(target = "targetType", source = "entry")
    @Mapping(target = "tenantId", source = "tenantId")
    @Mapping(target = "actorType", source = "actor.type")
    @Mapping(target = "actorId", source = "actor.id")
    @Mapping(target = "actorEmail", source = "actor.email")
    @Mapping(target = "actorRoles", source = "actor.roles")
    @Mapping(target = "sourceIp", source = "requestInfo.ip")
    @Mapping(target = "correlationId", source = "requestInfo.requestId")
    @Mapping(target = "approverId", source = "actor.approver.id")
    @Mapping(target = "actorName", ignore = true)
    @Mapping(target = "onBehalfOfName", ignore = true)
    @Mapping(target = "approverName", ignore = true)
    AuditEvent toEvent(AuditEntry entry, AuditActor actor, AuditRequestInfo requestInfo, String tenantId,
                       String parentEventId, Instant occurredAt);

    default String idOf(AuditEntry entry) {
        return Objects.requireNonNullElseGet(entry.getId(), () -> UlidCreator.getUlid().toString());
    }

    default String parentEventIdOf(AuditEntry entry, String parentEventId) {
        return entry.getParentEventId() != null ? entry.getParentEventId() : parentEventId;
    }

    default AuditTargetType targetTypeOf(AuditEntry entry) {
        return Objects.requireNonNullElse(entry.getTargetType(), entry.getAction().getTargetType());
    }
}
