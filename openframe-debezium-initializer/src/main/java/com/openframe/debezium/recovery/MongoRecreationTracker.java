package com.openframe.debezium.recovery;

import com.openframe.data.document.connector.ConnectorRecreationEvent;
import com.openframe.data.repository.connector.ConnectorRecreationEventRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;

/**
 * Mongo-backed rolling-window limiter for connector recreations.
 * Shared across all management replicas: every recreate inserts a document; the
 * limit check counts documents in the last hour for the given base name. Stale
 * events are purged on each write — no TTL index needed.
 *
 * Activated by {@code openframe.debezium.recovery.recreation.enabled=true}.
 */
@Slf4j
@Component
@ConditionalOnProperty(name = "openframe.debezium.recovery.recreation.enabled", havingValue = "true")
public class MongoRecreationTracker implements RecreationTracker {

    private static final Duration WINDOW = Duration.ofHours(1);

    private final ConnectorRecreationEventRepository repository;
    private final int maxPerHour;

    public MongoRecreationTracker(
            ConnectorRecreationEventRepository repository,
            @Value("${openframe.debezium.recovery.max-recreations-per-hour:1}") int maxPerHour) {
        this.repository = repository;
        this.maxPerHour = maxPerHour;
    }

    @Override
    public boolean canRecreate(String baseName) {
        long recent = repository.countByBaseNameAndCreatedAtAfter(baseName, cutoff());
        boolean allowed = recent < maxPerHour;
        if (!allowed) {
            log.warn("Recreation limit reached for '{}': {}/{} in last hour", baseName, recent, maxPerHour);
        }
        return allowed;
    }

    @Override
    public void record(String baseName) {
        repository.save(ConnectorRecreationEvent.builder()
                .baseName(baseName)
                .createdAt(Instant.now())
                .build());
        log.info("Recorded recreation for '{}'", baseName);
        repository.deleteByCreatedAtBefore(cutoff());
    }

    private Instant cutoff() {
        return Instant.now().minus(WINDOW);
    }
}
