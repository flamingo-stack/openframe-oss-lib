package com.openframe.data.reactive.service;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.Expiry;
import com.openframe.data.document.audit.AuditActor;
import com.openframe.data.document.audit.AuditEntry;
import com.openframe.data.document.audit.AuditEvent;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.user.User;
import com.openframe.data.mapper.AuditEventMapper;
import com.openframe.data.reactive.repository.audit.ReactiveAuditEventRepository;
import com.openframe.data.reactive.repository.device.ReactiveMachineRepository;
import com.openframe.data.reactive.repository.user.ReactiveUserRepository;
import com.openframe.data.repository.redis.ReactiveAuditOnceRepository;
import com.openframe.data.service.AuditTenants;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;
import org.springframework.util.Assert;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.List;
import java.util.Objects;

import static com.openframe.data.document.audit.AuditActorType.FAE;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReactiveAuditEventWriter {

    private static final int CLAIMED_KEYS = 10_000;

    private final ReactiveAuditEventRepository auditEventRepository;
    private final ReactiveUserRepository userRepository;
    private final ReactiveMachineRepository machineRepository;
    private final ReactiveAuditOnceRepository auditOnceRepository;
    private final AuditEventMapper auditEventMapper;
    private final AuditTenants auditTenants;
    private final Cache<String, Duration> claimedHere = Caffeine.newBuilder()
            .expireAfter(Expiry.creating((String _, Duration window) -> window))
            .maximumSize(CLAIMED_KEYS)
            .build();
    @Value("${openframe.audit.enabled}")
    private final boolean enabled;

    public Mono<Void> writeAll(List<AuditEntry> entries, Mono<AuditCaller> caller) {
        entries.forEach(ReactiveAuditEventWriter::requireActionAndOutcome);
        if (!enabled || entries.isEmpty()) {
            return Mono.empty();
        }
        return caller.flatMap(known -> save(entries, known))
                .onErrorResume(e -> notRecorded(entries.getFirst(), e));
    }

    public Mono<Void> writeOnce(AuditEntry entry, Mono<AuditCaller> caller, String key, Duration window) {
        requireActionAndOutcome(entry);
        if (!enabled) {
            return Mono.empty();
        }
        return caller.flatMap(known -> firstWithin(entry, known, key, window)
                        .flatMap(first -> first ? save(List.of(entry), known) : Mono.<Void>empty()))
                .onErrorResume(e -> notRecorded(entry, e));
    }

    private Mono<Boolean> firstWithin(AuditEntry entry, AuditCaller caller, String key, Duration window) {
        String tenantId = tenantOf(entry, caller);
        String onceKey = String.join(":", entry.getAction().getName(), key,
                Objects.requireNonNullElse(caller.actor().id(), "-"));
        String claimKey = onceKey + ":" + Objects.requireNonNullElse(tenantId, "-");
        if (claimedHere.getIfPresent(claimKey) != null) {
            return Mono.just(false);
        }
        return auditOnceRepository.claim(onceKey, window, tenantId)
                .doOnNext(_ -> claimedHere.put(claimKey, window))
                .onErrorResume(DataAccessException.class, e -> {
                    log.error("Audit dedupe lookup failed, the event is recorded", e);
                    return Mono.just(true);
                });
    }

    private Mono<Void> save(List<AuditEntry> entries, AuditCaller caller) {
        AuditActor actor = caller.actor();
        List<AuditEvent> events = entries.stream()
                .map(entry -> auditEventMapper.toEvent(entry, actor, caller.source(), tenantOf(entry, caller), null))
                .toList();
        return Mono.when(nameOf(actor).doOnNext(name -> events.forEach(event -> event.setActorName(name))),
                        onBehalfOfNameOf(actor).doOnNext(name -> events.forEach(event -> event.setOnBehalfOfName(name))))
                .then(Mono.defer(() -> insert(events)));
    }

    private String tenantOf(AuditEntry entry, AuditCaller caller) {
        return caller.actor().tenantFor(entry.getTenantId(), auditTenants.superTenantId(), caller::servedTenantId);
    }

    private Mono<String> nameOf(AuditActor actor) {
        if (actor.name() != null) {
            return Mono.just(actor.name());
        }
        if (actor.id() == null) {
            return Mono.empty();
        }
        return switch (actor.type()) {
            case USER, STAFF -> lookup(userRepository.findById(actor.id())).mapNotNull(User::fullName);
            case DEVICE -> lookup(machineRepository.findByMachineId(actor.id())).mapNotNull(Machine::getHostname);
            default -> Mono.empty();
        };
    }

    private Mono<String> onBehalfOfNameOf(AuditActor actor) {
        if (actor.onBehalfOfId() == null) {
            return Mono.empty();
        }
        return actor.type() == FAE
                ? lookup(machineRepository.findByMachineId(actor.onBehalfOfId())).mapNotNull(Machine::getHostname)
                : lookup(userRepository.findById(actor.onBehalfOfId())).mapNotNull(User::fullName);
    }

    private Mono<Void> insert(List<AuditEvent> events) {
        return auditEventRepository.insert(events)
                .then()
                .onErrorResume(DataAccessException.class, e -> {
                    log.error("Audit events not stored: {}", events, e);
                    return Mono.empty();
                });
    }

    private static void requireActionAndOutcome(AuditEntry entry) {
        Assert.state(entry.getAction() != null, "An audit entry needs an action");
        Assert.state(entry.getOutcome() != null, "An audit entry needs an outcome");
    }

    private static Mono<Void> notRecorded(AuditEntry entry, Throwable e) {
        log.error("Audit event not recorded for {}", entry.getAction().getName(), e);
        return Mono.empty();
    }

    private static <T> Mono<T> lookup(Mono<T> query) {
        return query.onErrorResume(DataAccessException.class, e -> {
            log.error("Audit lookup failed, the event is stored without its result", e);
            return Mono.empty();
        });
    }
}
