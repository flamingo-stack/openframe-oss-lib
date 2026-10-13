package com.openframe.data.cassandra.config;

import com.datastax.oss.driver.api.core.CqlSession;
import org.springframework.context.SmartLifecycle;
import org.springframework.data.cassandra.core.CassandraAdminTemplate;
import org.springframework.data.cassandra.core.CassandraPersistentEntitySchemaCreator;
import org.springframework.data.cassandra.core.convert.CassandraConverter;
import org.springframework.data.cassandra.core.cql.CqlTemplate;

import java.time.Duration;

/**
 * Creates the entity tables, user types and indexes if they do not exist (Spring Data's CREATE_IF_NOT_EXISTS) from
 * {@link SmartLifecycle#start()} rather than while the session factory is created, so creating the context needs no
 * Cassandra. The lowest phase runs it before the Kafka listeners and the web server start, and an exception still
 * fails startup.
 */
class CassandraSchemaInitializer implements SmartLifecycle {

    static final int PHASE = Integer.MIN_VALUE;

    // A schema change waits for cluster-wide agreement, which takes longer than the default request timeout,
    // more so while several services create their tables at once after a deploy.
    static final Duration SCHEMA_CHANGE_TIMEOUT = Duration.ofSeconds(30);

    private final CqlSession session;
    private final CassandraConverter converter;
    private volatile boolean running;

    CassandraSchemaInitializer(CqlSession session, CassandraConverter converter) {
        this.session = session;
        this.converter = converter;
    }

    @Override
    public void start() {
        CqlTemplate cql = new CqlTemplate(session);
        cql.setExecutionProfileResolver(statement -> statement.setTimeout(SCHEMA_CHANGE_TIMEOUT));
        CassandraPersistentEntitySchemaCreator schema = new CassandraPersistentEntitySchemaCreator(
                converter.getMappingContext(), new CassandraAdminTemplate(cql, converter));
        try {
            schema.createUserTypes(true);
            schema.createTables(true);
            schema.createIndexes(true);
        } catch (RuntimeException e) {
            throw new IllegalStateException("Cassandra schema creation failed", e);
        }
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

    @Override
    public int getPhase() {
        return PHASE;
    }
}
