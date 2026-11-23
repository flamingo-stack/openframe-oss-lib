package com.openframe.client.service.identitysplit;

import com.openframe.data.nats.model.IdentitySplitMessage;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.nats.client.Connection;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;

import static java.lang.String.format;

@Service
@ConditionalOnProperty(name = "openframe.agent.identity-split.enabled", havingValue = "true")
@Slf4j
public class MachineIdentityConflictService {

    static final Duration SESSION_TTL = Duration.ofMinutes(10);
    static final Duration REQUEST_INTERVAL = Duration.ofMinutes(5);
    static final String CONFLICTS_COUNTER = "openframe.agent.identity_conflicts";
    private static final String SUBJECT_TEMPLATE = "machine.%s.identity-split";

    private record SplitRequest(String sessionId, Instant requestedAt, boolean taken) {
    }

    private final Connection natsConnection;
    private final ObjectMapper objectMapper;
    private final Clock clock;
    private final Counter conflicts;
    private final Map<String, MachineSessions> machines = new ConcurrentHashMap<>();
    private final Map<String, SplitRequest> requests = new ConcurrentHashMap<>();

    @Autowired
    public MachineIdentityConflictService(Connection natsConnection, ObjectMapper objectMapper,
                                          MeterRegistry meterRegistry) {
        this(natsConnection, objectMapper, meterRegistry, Clock.systemUTC());
    }

    MachineIdentityConflictService(Connection natsConnection, ObjectMapper objectMapper,
                                   MeterRegistry meterRegistry, Clock clock) {
        this.natsConnection = natsConnection;
        this.objectMapper = objectMapper;
        this.clock = clock;
        this.conflicts = Counter.builder(CONFLICTS_COUNTER)
                .description("Heartbeats showing two devices running with one machine identity")
                .register(meterRegistry);
    }

    public void onHeartbeat(String machineId, String sessionId) {
        Instant now = clock.instant();
        AtomicReference<Optional<String>> toSplit = new AtomicReference<>(Optional.empty());
        machines.compute(machineId, (id, sessions) -> {
            MachineSessions tracked = sessions == null ? new MachineSessions(SESSION_TTL) : sessions;
            toSplit.set(tracked.heartbeat(sessionId, now));
            return tracked;
        });
        toSplit.get().ifPresent(session -> requestSplit(machineId, session, now));
    }

    public boolean takeSplitRequest(String machineId, String sessionId) {
        Instant now = clock.instant();
        AtomicReference<Boolean> taken = new AtomicReference<>(false);
        requests.computeIfPresent(machineId, (id, request) -> {
            boolean open = !request.taken() && request.sessionId().equals(sessionId)
                    && request.requestedAt().plus(SESSION_TTL).isAfter(now);
            if (!open) {
                return request;
            }
            taken.set(true);
            return new SplitRequest(request.sessionId(), request.requestedAt(), true);
        });
        return taken.get();
    }

    @Scheduled(fixedDelay = 600_000)
    void forgetStale() {
        Instant now = clock.instant();
        machines.entrySet().removeIf(entry -> entry.getValue().prune(now));
        requests.values().removeIf(request -> request.requestedAt().plus(SESSION_TTL).isBefore(now));
    }

    private void requestSplit(String machineId, String sessionId, Instant now) {
        conflicts.increment();
        SplitRequest previous = requests.get(machineId);
        if (previous != null && previous.requestedAt().plus(REQUEST_INTERVAL).isAfter(now)) {
            return;
        }
        requests.put(machineId, new SplitRequest(sessionId, now, false));
        log.warn("Two devices run with the identity of machine {}, asking session {} to register as a machine of its own",
                machineId, sessionId);
        publish(machineId, sessionId);
    }

    private void publish(String machineId, String sessionId) {
        try {
            byte[] payload = objectMapper.writeValueAsBytes(new IdentitySplitMessage(sessionId));
            natsConnection.publish(format(SUBJECT_TEMPLATE, machineId), payload);
        } catch (RuntimeException e) {
            log.error("Failed to ask session {} of machine {} to split off", sessionId, machineId, e);
        }
    }
}
