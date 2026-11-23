package com.openframe.client.service.identityconflict;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;

@Service
@ConditionalOnProperty(name = "openframe.agent.identity-conflict.enabled", havingValue = "true")
@Slf4j
public class MachineIdentityConflictService {

    static final Duration SESSION_TTL = Duration.ofMinutes(10);
    static final Duration WARN_INTERVAL = Duration.ofMinutes(5);
    static final String CONFLICTS_COUNTER = "openframe.agent.identity_conflicts";

    private final Clock clock;
    private final Counter conflicts;
    private final Map<String, MachineSessions> machines = new ConcurrentHashMap<>();
    private final Map<String, Instant> lastWarned = new ConcurrentHashMap<>();

    @Autowired
    public MachineIdentityConflictService(MeterRegistry meterRegistry) {
        this(meterRegistry, Clock.systemUTC());
    }

    MachineIdentityConflictService(MeterRegistry meterRegistry, Clock clock) {
        this.clock = clock;
        this.conflicts = Counter.builder(CONFLICTS_COUNTER)
                .description("Heartbeats showing two devices running with one machine identity")
                .register(meterRegistry);
    }

    public void onHeartbeat(String machineId, String sessionId) {
        Instant now = clock.instant();
        AtomicReference<Optional<String>> newer = new AtomicReference<>(Optional.empty());
        machines.compute(machineId, (id, sessions) -> {
            MachineSessions tracked = sessions == null ? new MachineSessions(SESSION_TTL) : sessions;
            newer.set(tracked.heartbeat(sessionId, now));
            return tracked;
        });
        newer.get().ifPresent(session -> reportConflict(machineId, session, now));
    }

    @Scheduled(fixedDelay = 600_000)
    void forgetStale() {
        Instant now = clock.instant();
        machines.entrySet().removeIf(entry -> entry.getValue().prune(now));
        lastWarned.values().removeIf(warnedAt -> warnedAt.plus(SESSION_TTL).isBefore(now));
    }

    private void reportConflict(String machineId, String newerSession, Instant now) {
        conflicts.increment();
        Instant warnedAt = lastWarned.get(machineId);
        if (warnedAt != null && warnedAt.plus(WARN_INTERVAL).isAfter(now)) {
            return;
        }
        lastWarned.put(machineId, now);
        log.warn("Two devices run with the identity of machine {}, the newer one has session {}", machineId, newerSession);
    }
}
