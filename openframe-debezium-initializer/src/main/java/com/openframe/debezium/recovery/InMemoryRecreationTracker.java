package com.openframe.debezium.recovery;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory rolling-window limiter for connector recreations — a Mongo-free
 * alternative to {@link MongoRecreationTracker} for the per-tenant cluster, where
 * each tenant runs its own management pod, so a JVM-local counter is inherently
 * tenant-scoped (no shared collection, no cross-tenant interference, no tenant
 * discriminator needed).
 *
 * <p>Activated by {@code openframe.debezium.recovery.recreation.in-memory=true};
 * takes precedence over the Mongo tracker (which backs off via
 * {@code @ConditionalOnMissingBean}).
 *
 * <p>Trade-off vs. the Mongo tracker: state is per-pod and resets on restart, and
 * is not shared across replicas. With the health-check {@code @SchedulerLock}
 * (one replica at a time) this is a soft cap that may be slightly exceeded under
 * multi-replica drift-recreates — acceptable for a runaway-protection limiter.
 */
@Slf4j
@Component
@Primary
@ConditionalOnProperty(name = "openframe.debezium.recovery.recreation.in-memory", havingValue = "true")
public class InMemoryRecreationTracker implements RecreationTracker {

    private static final Duration WINDOW = Duration.ofHours(1);

    private final int maxPerHour;
    private final Map<String, Deque<Instant>> eventsByBase = new ConcurrentHashMap<>();

    public InMemoryRecreationTracker(
            @Value("${openframe.debezium.recovery.max-recreations-per-hour:1}") int maxPerHour) {
        this.maxPerHour = maxPerHour;
    }

    @Override
    public synchronized boolean canRecreate(String baseName) {
        long recent = prunedQueue(baseName).size();
        boolean allowed = recent < maxPerHour;
        if (!allowed) {
            log.warn("Recreation limit reached for '{}': {}/{} in last hour", baseName, recent, maxPerHour);
        }
        return allowed;
    }

    @Override
    public synchronized void record(String baseName) {
        eventsByBase.computeIfAbsent(baseName, k -> new ArrayDeque<>()).addLast(Instant.now());
        log.info("Recorded recreation for '{}'", baseName);
    }

    /**
     * Return the base's event queue with entries older than the window dropped.
     * Pruning on read keeps the map bounded without a background sweep.
     */
    private Deque<Instant> prunedQueue(String baseName) {
        Instant cutoff = Instant.now().minus(WINDOW);
        Deque<Instant> queue = eventsByBase.computeIfAbsent(baseName, k -> new ArrayDeque<>());
        while (!queue.isEmpty() && queue.peekFirst().isBefore(cutoff)) {
            queue.pollFirst();
        }
        return queue;
    }
}
