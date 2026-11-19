package com.openframe.audit;

import com.openframe.audit.targets.AuditTarget;
import com.openframe.audit.targets.AuditTargetRegistry;
import com.openframe.audit.targets.AuditTargetRepository;
import com.openframe.audit.targets.LoadedTarget;
import com.openframe.core.util.Sha256;
import com.openframe.data.document.audit.AuditEvent;
import com.openframe.data.document.audit.AuditTargetType;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.user.User;
import com.openframe.data.mapper.AuditEventMapper;
import com.openframe.data.model.audit.AuditActor;
import com.openframe.data.model.audit.AuditEntry;
import com.openframe.data.repository.audit.AuditEventRepository;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.user.UserRepository;
import com.openframe.data.service.AuditClock;
import com.openframe.data.service.AuditTenantResolver;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

import static com.openframe.data.document.audit.AuditActorType.FAE;
import static org.apache.commons.lang3.ObjectUtils.firstNonNull;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditEventWriter {

    private final AuditEventRepository auditEventRepository;
    private final UserRepository userRepository;
    private final MachineRepository machineRepository;
    private final AuditTargetRepository targetRepository;
    private final AuditTenantResolver tenantResolver;
    private final AuditTargetRegistry targets;
    private final AuditEventMapper auditEventMapper;
    private final ObjectMapper objectMapper;
    private final AuditClock auditClock;
    private final Map<String, Boolean> childSavedByRunningParent = new ConcurrentHashMap<>();

    boolean write(List<AuditEntry> entries, AuditContext context, boolean loadTarget) {
        ActorNames names = namesOf(context.actor());
        List<AuditEvent> events = entries.stream()
                .map(entry -> loadTarget ? withTargetFields(entry) : entry)
                .map(this::withDeviceOrganization)
                .map(entry -> eventOf(entry, context, names))
                .toList();
        try {
            auditEventRepository.insert(events);
            events.stream()
                    .map(AuditEvent::getParentEventId)
                    .filter(Objects::nonNull)
                    .forEach(parentEventId -> childSavedByRunningParent.computeIfPresent(parentEventId,
                            (_, _) -> Boolean.TRUE));
            return true;
        } catch (DataAccessException e) {
            log.error("Audit events not stored: {}", events.stream().map(this::asJson).toList(), e);
            return false;
        }
    }

    void trackChildrenOf(String eventId) {
        childSavedByRunningParent.put(eventId, Boolean.FALSE);
    }

    boolean hadChildren(String eventId) {
        return Boolean.TRUE.equals(childSavedByRunningParent.remove(eventId));
    }

    String targetIdOf(AuditTargetType targetType, String targetId) {
        if (targetId != null) {
            return targetId;
        }
        boolean keyedByTenant = targetType == AuditTargetType.TENANT
                || targets.find(targetType).stream().anyMatch(AuditTarget::keyedByTenant);
        return keyedByTenant ? tenantResolver.isolatedTenantId() : null;
    }

    static <T> Optional<T> tryFind(String what, Supplier<Optional<T>> query) {
        try {
            return query.get();
        } catch (DataAccessException e) {
            log.error("Audit lookup of the {} failed, the event is stored without it", what, e);
            return Optional.empty();
        }
    }

    private AuditEntry withTargetFields(AuditEntry entry) {
        boolean complete = entry.getTargetName() != null && entry.getOrganizationId() != null && entry.getDeviceId() != null;
        if (complete) {
            return entry;
        }
        AuditTargetType targetType = entry.targetTypeOrDefault();
        String targetId = targetIdOf(targetType, entry.getTargetId());
        if (targetId == null) {
            return entry;
        }
        try {
            return targetRepository.load(targets.find(targetType), targetId)
                    .map(loaded -> entry.toBuilder()
                            .targetName(firstNonNull(entry.getTargetName(), loaded.name()))
                            .organizationId(firstNonNull(entry.getOrganizationId(), loaded.organizationId()))
                            .deviceId(firstNonNull(entry.getDeviceId(), loaded.deviceId()))
                            .targetTenantId(firstNonNull(loaded.tenantId(), entry.getTargetTenantId()))
                            .build())
                    .orElse(entry);
        } catch (RuntimeException e) {
            log.error("Audit target {} not read, {} is stored without its name", targetId, entry.getAction().getName(), e);
            return entry;
        }
    }

    private AuditEntry withDeviceOrganization(AuditEntry entry) {
        if (entry.getOrganizationId() != null || entry.getDeviceId() == null) {
            return entry;
        }
        try {
            return targetRepository.load(targets.find(AuditTargetType.DEVICE), entry.getDeviceId())
                    .map(LoadedTarget::organizationId)
                    .map(organizationId -> entry.toBuilder().organizationId(organizationId).build())
                    .orElse(entry);
        } catch (RuntimeException e) {
            log.error("Device {} not read, {} is stored without its organization", entry.getDeviceId(),
                    entry.getAction().getName(), e);
            return entry;
        }
    }

    private record ActorNames(String actor, String onBehalfOf, String approver) {
    }

    private ActorNames namesOf(AuditActor actor) {
        return new ActorNames(nameOf(actor), onBehalfOfNameOf(actor),
                actor.approver() == null ? null : nameOf(actor.approver()));
    }

    private String nameOf(AuditActor actor) {
        if (actor.name() != null) {
            return actor.name();
        }
        if (actor.id() == null) {
            return null;
        }
        return switch (actor.type()) {
            case USER, STAFF -> userNameOf(actor.id());
            case DEVICE -> deviceNameOf(actor.id());
            default -> null;
        };
    }

    private String onBehalfOfNameOf(AuditActor actor) {
        if (actor.onBehalfOfId() == null) {
            return null;
        }
        return actor.type() == FAE ? deviceNameOf(actor.onBehalfOfId()) : userNameOf(actor.onBehalfOfId());
    }

    private String userNameOf(String userId) {
        return tryFind("user name", () -> userRepository.findById(userId)).map(User::fullName).orElse(null);
    }

    private String deviceNameOf(String machineId) {
        return tryFind("device name", () -> machineRepository.findByMachineId(machineId)).map(Machine::deviceName).orElse(null);
    }

    private AuditEvent eventOf(AuditEntry entry, AuditContext context, ActorNames names) {
        AuditActor actor = context.actor();
        String tenantId = tenantResolver.tenantFor(actor, entry.getTenantId());
        AuditTargetType targetType = entry.targetTypeOrDefault();
        String targetId = targetIdOf(targetType, entry.getTargetId());
        boolean secretId = targets.find(targetType).stream().anyMatch(AuditTarget::secretId);
        AuditEntry entryToUse = withoutFieldsOfAnotherTenant(entry, tenantId).toBuilder()
                .targetId(secretId && targetId != null ? Sha256.hex(targetId) : targetId)
                .build();
        AuditEvent event = auditEventMapper.toEvent(entryToUse, actor, context.requestInfo(), tenantId,
                context.parentEventId(), auditClock.now());
        event.setActorName(names.actor());
        event.setOnBehalfOfName(names.onBehalfOf());
        event.setApproverName(names.approver());
        return event;
    }

    private AuditEntry withoutFieldsOfAnotherTenant(AuditEntry entry, String tenantId) {
        if (!tenantResolver.belongsToAnotherTenant(entry.getTargetTenantId(), tenantId)) {
            return entry;
        }
        log.warn("Audit target {} of {} belongs to another tenant, the event is stored without its name, customer, "
                + "device and changes", entry.getTargetId(), entry.getAction().getName());
        return entry.toBuilder().targetName(null).organizationId(null).deviceId(null).changes(null).build();
    }

    private String asJson(AuditEvent event) {
        try {
            return objectMapper.writeValueAsString(event);
        } catch (JacksonException e) {
            return event.toString();
        }
    }
}
