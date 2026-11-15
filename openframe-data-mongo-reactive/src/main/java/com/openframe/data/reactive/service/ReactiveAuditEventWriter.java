package com.openframe.data.reactive.service;

import com.openframe.data.document.audit.AuditEvent;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.user.User;
import com.openframe.data.mapper.AuditEventMapper;
import com.openframe.data.model.audit.AuditActor;
import com.openframe.data.model.audit.AuditEntry;
import com.openframe.data.reactive.repository.audit.ReactiveAuditEventRepository;
import com.openframe.data.reactive.repository.device.ReactiveMachineRepository;
import com.openframe.data.reactive.repository.user.ReactiveUserRepository;
import com.openframe.data.repository.redis.ReactiveAuditOnceRepository;
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

import static com.openframe.data.document.audit.AuditActorType.FAE;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReactiveAuditEventWriter {

    private final ReactiveAuditEventRepository auditEventRepository;
    private final ReactiveUserRepository userRepository;
    private final ReactiveMachineRepository machineRepository;
    private final ReactiveAuditOnceRepository auditOnceRepository;
    private final AuditEventMapper auditEventMapper;
    private final AuditTenantResolver tenantResolver;
    private final AuditClock auditClock;
    private final ObjectMapper objectMapper;
    @Value("${openframe.audit.enabled}")
    private final boolean enabled;

    public Mono<Void> writeAll(List<AuditEntry> entries, Mono<AuditCaller> caller) {
        entries.forEach(AuditEntry::requireOutcome);
        if (!enabled || entries.isEmpty()) {
            return Mono.empty();
        }
        return caller.flatMap(known -> save(entries, known))
                .onErrorResume(e -> notRecorded(entries.getFirst(), e));
    }

    public Mono<Void> writeOnce(AuditEntry entry, Mono<AuditCaller> caller, String key, Duration window) {
        entry.requireOutcome();
        if (!enabled) {
            return Mono.empty();
        }
        return caller.flatMap(known -> firstWithin(entry, known, key, window)
                        .flatMap(first -> first ? save(List.of(entry), known) : Mono.empty()))
                .onErrorResume(e -> notRecorded(entry, e));
    }

    private Mono<Boolean> firstWithin(AuditEntry entry, AuditCaller caller, String key, Duration window) {
        String tenantId = tenantOf(entry, caller);
        String onceKey = String.join(":", entry.getAction().getName(), key, caller.actor().id());
        return auditOnceRepository.claim(onceKey, window, tenantId)
                .onErrorResume(DataAccessException.class, e -> {
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
        return Mono.when(nameOf(actor).doOnNext(name -> events.forEach(event -> event.setActorName(name))),
                        onBehalfOfNameOf(actor)
                                .doOnNext(name -> events.forEach(event -> event.setOnBehalfOfName(name))))
                .then(Mono.defer(() -> insert(events)));
    }

    private String tenantOf(AuditEntry entry, AuditCaller caller) {
        return caller.actor().tenantFor(entry.getTenantId(), tenantResolver.superTenantId(), caller::servedTenantId);
    }

    private Mono<String> nameOf(AuditActor actor) {
        if (actor.name() != null) {
            return Mono.just(actor.name());
        }
        if (actor.id() == null) {
            return Mono.empty();
        }
        return switch (actor.type()) {
            case USER, STAFF -> tryFind("user name", userRepository.findById(actor.id())).mapNotNull(User::fullName);
            case DEVICE -> tryFind("device name", machineRepository.findByMachineId(actor.id())).mapNotNull(Machine::deviceName);
            default -> Mono.empty();
        };
    }

    private Mono<String> onBehalfOfNameOf(AuditActor actor) {
        if (actor.onBehalfOfId() == null) {
            return Mono.empty();
        }
        return actor.type() == FAE
                ? tryFind("device name", machineRepository.findByMachineId(actor.onBehalfOfId())).mapNotNull(Machine::deviceName)
                : tryFind("user name", userRepository.findById(actor.onBehalfOfId())).mapNotNull(User::fullName);
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
