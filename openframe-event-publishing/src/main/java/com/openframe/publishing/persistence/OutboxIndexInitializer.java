package com.openframe.publishing.persistence;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.SmartLifecycle;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoOperations;
import org.springframework.data.mongodb.core.index.Index;

import java.time.Duration;

// Explicit like MongoIndexConfig: auto-index-creation is off by default, so @Indexed alone would create nothing.
@Slf4j
@RequiredArgsConstructor
public class OutboxIndexInitializer implements SmartLifecycle {

    static final String ROW_EXPIRY = "event_outbox_occurredAt_ttl";

    // Debezium reads a row right after its insert; the TTL only has to outlast a Debezium outage.
    static final Duration TIME_TO_LIVE = Duration.ofDays(7);

    private final MongoOperations mongoOperations;
    private volatile boolean running;

    // Phase 0, as MongoIndexConfig: after the context refresh, before the web server takes traffic.
    @Override
    public int getPhase() {
        return 0;
    }

    @Override
    public void start() {
        Index rowExpiry = new Index()
            .on(OutboxEvent.Fields.occurredAt, Sort.Direction.ASC)
            .expire(TIME_TO_LIVE)
            .named(ROW_EXPIRY);

        mongoOperations.indexOps(OutboxEvent.class)
            .createIndex(rowExpiry);

        log.debug("Ensured TTL index {} on the outbox ({} days)", ROW_EXPIRY, TIME_TO_LIVE.toDays());
        running = true;
    }

    @Override
    public void stop() {
        running = false;
    }

    @Override
    public boolean isRunning() {
        return running;
    }
}
