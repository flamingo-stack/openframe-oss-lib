package com.openframe.data.reactive.service;

import com.openframe.data.document.audit.AuditActor;
import com.openframe.data.document.audit.AuditEntry;
import com.openframe.data.document.audit.AuditEvent;
import com.openframe.data.document.audit.AuditSource;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.user.User;
import com.openframe.data.mapper.AuditEventMapper;
import com.openframe.data.reactive.repository.audit.ReactiveAuditEventRepository;
import com.openframe.data.reactive.repository.device.ReactiveMachineRepository;
import com.openframe.data.reactive.repository.user.ReactiveUserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;
import org.springframework.util.Assert;
import reactor.core.publisher.Mono;

import static com.openframe.data.document.audit.AuditActorType.FAE;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReactiveAuditEventWriter {

    private final ReactiveAuditEventRepository auditEventRepository;
    private final ReactiveUserRepository userRepository;
    private final ReactiveMachineRepository machineRepository;
    private final AuditEventMapper auditEventMapper;
    @Value("${openframe.audit.enabled}")
    private final boolean enabled;

    public Mono<Void> write(AuditEntry entry, AuditActor actor, AuditSource source, String tenantId) {
        Assert.state(entry.getAction() != null, "An audit entry needs an action");
        Assert.state(entry.getOutcome() != null, "An audit entry needs an outcome");
        if (!enabled) {
            return Mono.empty();
        }
        AuditEvent event = auditEventMapper.toEvent(entry, actor, source, tenantId, null);
        return Mono.when(nameOf(actor).doOnNext(event::setActorName),
                        onBehalfOfNameOf(actor).doOnNext(event::setOnBehalfOfName))
                .then(Mono.defer(() -> save(event)))
                .onErrorResume(e -> {
                    log.error("Audit event not recorded for {}", entry.getAction().getName(), e);
                    return Mono.empty();
                });
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

    private Mono<Void> save(AuditEvent event) {
        return auditEventRepository.insert(event)
                .then()
                .onErrorResume(DataAccessException.class, e -> {
                    log.error("Audit event not stored: {}", event, e);
                    return Mono.empty();
                });
    }

    private static <T> Mono<T> lookup(Mono<T> query) {
        return query.onErrorResume(DataAccessException.class, e -> {
            log.error("Audit lookup failed, the event is stored without its result", e);
            return Mono.empty();
        });
    }
}
