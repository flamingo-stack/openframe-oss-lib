package com.openframe.data.cassandra.config;

import com.datastax.oss.driver.api.core.CqlSession;
import org.springframework.context.SmartLifecycle;
import org.springframework.data.cassandra.config.SchemaAction;
import org.springframework.data.cassandra.config.SessionFactoryFactoryBean;
import org.springframework.data.cassandra.core.convert.CassandraConverter;

/**
 * Runs the schema action from {@link SmartLifecycle#start()} rather than while the session factory
 * is created, so creating the context needs no Cassandra. The lowest phase runs it before the
 * Kafka listeners and the web server start, and an exception still fails startup.
 */
class CassandraSchemaInitializer implements SmartLifecycle {

    static final int PHASE = Integer.MIN_VALUE;

    private final CqlSession session;
    private final CassandraConverter converter;
    private final SchemaAction schemaAction;
    private volatile boolean running;

    CassandraSchemaInitializer(CqlSession session, CassandraConverter converter, SchemaAction schemaAction) {
        this.session = session;
        this.converter = converter;
        this.schemaAction = schemaAction;
    }

    @Override
    public void start() {
        // The factory bean that used to run it at creation, run here instead with the same settings
        SessionFactoryFactoryBean schema = new SessionFactoryFactoryBean();
        schema.setSession(session);
        schema.setConverter(converter);
        schema.setSchemaAction(schemaAction);
        try {
            schema.afterPropertiesSet();
        } catch (Exception e) {
            throw new IllegalStateException("Cassandra schema action " + schemaAction + " failed", e);
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
