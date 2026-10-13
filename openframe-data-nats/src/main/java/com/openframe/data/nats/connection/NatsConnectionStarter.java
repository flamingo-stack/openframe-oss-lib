package com.openframe.data.nats.connection;

import io.nats.client.Connection;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.SmartLifecycle;

/**
 * Connects the {@link LazyNatsConnection} at start, in the lowest phase: before the listeners subscribe and the
 * web server takes traffic, and a NATS that is down fails startup as the eager connection did. Without a server
 * configured there is no connection, and nothing to start.
 */
@Slf4j
class NatsConnectionStarter implements SmartLifecycle {

    private final ObjectProvider<Connection> connection;
    private volatile boolean running;

    NatsConnectionStarter(ObjectProvider<Connection> connection) {
        this.connection = connection;
    }

    @Override
    public void start() {
        Connection natsConnection = connection.getIfAvailable();
        if (natsConnection != null) {
            log.info("Connected to NATS: {}", natsConnection.getConnectedUrl());
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
        return Integer.MIN_VALUE;
    }
}
