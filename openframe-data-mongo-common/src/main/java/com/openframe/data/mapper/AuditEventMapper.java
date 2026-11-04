package com.openframe.data.mapper;

import com.github.f4b6a3.ulid.UlidCreator;
import com.openframe.data.document.audit.AuditActor;
import com.openframe.data.document.audit.AuditEntry;
import com.openframe.data.document.audit.AuditEvent;
import com.openframe.data.document.audit.AuditSource;
import com.openframe.data.document.audit.AuditTargetType;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.ReportingPolicy;

import java.time.Instant;
import java.util.Objects;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR,
        imports = {UlidCreator.class, Instant.class, AuditEvent.class})
public interface AuditEventMapper {

    @Mapping(target = "id", expression = "java(UlidCreator.getUlid().toString())")
    @Mapping(target = "schemaVersion", expression = "java(AuditEvent.SCHEMA_VERSION)")
    @Mapping(target = "occurredAt", expression = "java(Instant.now())")
    @Mapping(target = "action", source = "entry.action.name")
    @Mapping(target = "targetType", source = "entry")
    @Mapping(target = "tenantId", source = "tenantId")
    @Mapping(target = "actorType", source = "actor.type")
    @Mapping(target = "actorId", source = "actor.id")
    @Mapping(target = "actorEmail", source = "actor.email")
    @Mapping(target = "roleSnapshot", source = "actor.roles")
    @Mapping(target = "sourceIp", source = "source.ip")
    @Mapping(target = "correlationId", source = "source.requestId")
    @Mapping(target = "approverId", source = "actor.approver.id")
    @Mapping(target = "actorName", ignore = true)
    @Mapping(target = "onBehalfOfName", ignore = true)
    @Mapping(target = "approverName", ignore = true)
    AuditEvent toEvent(AuditEntry entry, AuditActor actor, AuditSource source, String tenantId);

    default AuditTargetType targetTypeOf(AuditEntry entry) {
        return Objects.requireNonNullElse(entry.getTargetType(), entry.getAction().getTargetType());
    }
}
