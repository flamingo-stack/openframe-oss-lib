package com.openframe.data.nats.connection;

import io.nats.client.Connection;
import io.nats.client.Nats;
import io.nats.client.Options;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.util.concurrent.CompletableFuture;
import java.util.function.Supplier;

/**
 * A {@link Connection} that connects on its first use instead of while the bean is created, so creating the
 * context needs no NATS: the AOT cache training run refreshes the context with nothing reachable. In a running
 * service {@link NatsConnectionStarter} makes the first use at start, so a NATS that is down still fails startup.
 */
final class LazyNatsConnection {

    static final String NOT_CONNECTED = "Lazy NATS connection (not connected)";

    private final Supplier<Options> options;
    private final Connection proxy;
    private volatile Connection connection;

    private LazyNatsConnection(Supplier<Options> options) {
        this.options = options;
        this.proxy = (Connection) Proxy.newProxyInstance(Connection.class.getClassLoader(),
                new Class<?>[] {Connection.class}, (target, method, args) -> invoke(method, args));
    }

    static Connection create(Supplier<Options> options) {
        return new LazyNatsConnection(options).proxy;
    }

    private Object invoke(Method method, Object[] args) throws Throwable {
        switch (method.getName()) {
            case "toString":
                return connection == null ? NOT_CONNECTED : connection.toString();
            case "hashCode":
                return System.identityHashCode(proxy);
            case "equals":
                return proxy == args[0];
            case "close":
                // Closing a connection that never connected must not connect it
                if (connection == null) {
                    return null;
                }
                break;
            case "drain":
                if (connection == null) {
                    return CompletableFuture.completedFuture(true);
                }
                break;
            default:
                break;
        }
        try {
            return method.invoke(connected(), args);
        } catch (InvocationTargetException e) {
            throw e.getCause();
        }
    }

    private Connection connected() {
        Connection current = connection;
        if (current != null) {
            return current;
        }
        synchronized (this) {
            if (connection == null) {
                connection = connect();
            }
            return connection;
        }
    }

    private Connection connect() {
        try {
            return Nats.connect(options.get());
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted while connecting to NATS", e);
        }
    }
}
