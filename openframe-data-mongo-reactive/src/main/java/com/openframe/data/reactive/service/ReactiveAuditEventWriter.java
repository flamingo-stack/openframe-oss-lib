package com.openframe.data.reactive.service;

import com.openframe.data.document.audit.AuditEvent;
import com.openframe.data.mapper.AuditEventMapper;
import com.openframe.data.model.audit.AuditActor;
import com.openframe.data.model.audit.AuditEntry;
import com.openframe.data.reactive.repository.audit.ReactiveAuditEventRepository;
import com.openframe.data.reactive.repository.device.ReactiveMachineRepository;
import com.openframe.data.reactive.repository.user.ReactiveUserRepository;
import com.openframe.data.repository.redis.ReactiveAuditWindowRepository;
import com.openframe.data.service.AuditClock;
import com.openframe.data.service.AuditTenantResolver;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

import java.time.Duration;
import java.util.List;
import java.util.function.BiConsumer;

import static com.openframe.data.document.audit.AuditActorType.FAE;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReactiveAuditEventWriter {

    private final ReactiveAuditEventRepository auditEventRepository;
    private final ReactiveUserRepository userRepository;
    private final ReactiveMachineRepository machineRepository;
    private final ReactiveAuditWindowRepository auditWindowRepository;
    private final AuditEventMapper auditEventMapper;
    private final AuditTenantResolver tenantResolver;
    private final AuditClock auditClock;
    private final ObjectMapper objectMapper;
    @Value("${openframe.audit.enabled}")
    private final boolean enabled;

    public Mono<Void> writeAll(List<AuditEntry> entries, Mono<AuditCaller> caller) {
        entries.forEach(AuditEntry::requireOutcome);
        if (!enabled) {
            return Mono.empty();
        }
        return saveOutsideRequest(caller.flatMap(known -> save(entries, known))
                .onErrorResume(e -> notRecorded(entries.getFirst(), e)));
    }

    public Mono<Void> writeOnce(AuditEntry entry, Mono<AuditCaller> caller, String key, Duration window) {
        entry.requireOutcome();
        if (!enabled) {
            return Mono.empty();
        }
        return saveOutsideRequest(caller.flatMap(known -> isFirstEventInWindow(entry, known, key, window)
                        .flatMap(first -> first ? save(List.of(entry), known) : Mono.empty()))
                .onErrorResume(e -> notRecorded(entry, e)));
    }

    private static Mono<Void> saveOutsideRequest(Mono<Void> write) {
        return Mono.deferContextual(requestContext -> {
            Mono<Void> started = write.contextWrite(requestContext).cache();
            started.subscribe();
            return started;
        });
    }

    private Mono<Boolean> isFirstEventInWindow(AuditEntry entry, AuditCaller caller, String key, Duration window) {
        return Mono.defer(() -> auditWindowRepository.claim(String.join(":", entry.getAction().getName(),
                                entry.getOutcome().name(), key, caller.actor().identity()), window,
                        tenantOf(entry, caller)))
                .onErrorResume(e -> {
                    log.error("Audit dedupe lookup failed, the event is recorded", e);
                    return Mono.just(true);
                });
    }

    private Mono<Void> save(List<AuditEntry> entries, AuditCaller caller) {
        AuditActor actor = caller.actor();
        List<AuditEvent> events = entries.stream()
                .map(entry -> auditEventMapper.toEvent(entry, actor, caller.requestInfo(), tenantOf(entry, caller),
                        null, auditClock.now()))
                .toList();
        return Mono.when(nameOf(actor).doOnNext(named -> setNameOnEvents(events, named, AuditEvent::setActorName)),
                        onBehalfOfNameOf(actor)
                                .doOnNext(named -> setNameOnEvents(events, named, AuditEvent::setOnBehalfOfName)))
                .then(Mono.defer(() -> insert(events)));
    }

    private void setNameOnEvents(List<AuditEvent> events, NameWithTenant named,
                                 BiConsumer<AuditEvent, String> setName) {
        events.stream()
                .filter(event -> named.tenantId() == null || named.tenantId().equals(event.getTenantId())
                        || named.tenantId().equals(tenantResolver.superTenantId()))
                .forEach(event -> setName.accept(event, named.name()));
    }

    private record NameWithTenant(String name, String tenantId) {
    }

    private String tenantOf(AuditEntry entry, AuditCaller caller) {
        return caller.actor().tenantFor(entry.getTenantId(), tenantResolver.superTenantId(), caller::servedTenantId);
    }

    private Mono<NameWithTenant> nameOf(AuditActor actor) {
        if (actor.name() != null) {
            return Mono.just(new NameWithTenant(actor.name(), null));
        }
        if (actor.id() == null) {
            return Mono.empty();
        }
        return switch (actor.type()) {
            case USER, STAFF -> userNameOf(actor.id());
            case DEVICE -> deviceNameOf(actor.id());
            default -> Mono.empty();
        };
    }

    private Mono<NameWithTenant> onBehalfOfNameOf(AuditActor actor) {
        if (actor.onBehalfOfId() == null) {
            return Mono.empty();
        }
        return actor.type() == FAE ? deviceNameOf(actor.onBehalfOfId()) : userNameOf(actor.onBehalfOfId());
    }

    private Mono<NameWithTenant> userNameOf(String userId) {
        return tryFind("user name", userRepository.findById(userId))
                .map(user -> new NameWithTenant(user.fullName(), user.getTenantId()));
    }

    private Mono<NameWithTenant> deviceNameOf(String machineId) {
        return tryFind("device name", machineRepository.findByMachineId(machineId))
                .map(machine -> new NameWithTenant(machine.deviceName(), machine.getTenantId()));
    }

    private Mono<Void> insert(List<AuditEvent> events) {
        return auditEventRepository.insert(events)
                .then()
                .onErrorResume(DataAccessException.class, e -> {
                    log.error("Audit events not stored: {}", events.stream().map(this::asJson).toList(), e);
                    return Mono.empty();
                });
    }

    private String asJson(AuditEvent event) {
        try {
            return objectMapper.writeValueAsString(event);
        } catch (JacksonException e) {
            return event.toString();
        }
    }

    private static Mono<Void> notRecorded(AuditEntry entry, Throwable e) {
        log.error("Audit event not recorded for {}", entry.getAction().getName(), e);
        return Mono.empty();
    }

    public static <T> Mono<T> tryFind(String what, Mono<T> query) {
        return query.onErrorResume(DataAccessException.class, e -> {
            log.error("Audit lookup of the {} failed, the event is stored without it", what, e);
            return Mono.empty();
        });
    }
}
