package com.openframe.data.cassandra.config;

import com.datastax.oss.driver.api.core.CqlSession;
import org.springframework.data.cassandra.config.CqlSessionFactoryBean;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;

/**
 * Hands out a {@link CqlSession} that connects on its first use instead of while the bean is
 * created, so creating the context needs no Cassandra: the AOT cache training run refreshes the
 * context with nothing reachable. In a running service the first use is the schema step in
 * {@link CassandraSchemaInitializer}, so a Cassandra that is down still fails startup.
 */
class LazyCqlSessionFactoryBean extends CqlSessionFactoryBean {

    private final Runnable beforeConnect;
    private final Consumer<CqlSession> afterConnect;
    private final CqlSession proxy;
    private volatile CqlSession session;

    LazyCqlSessionFactoryBean(Runnable beforeConnect, Consumer<CqlSession> afterConnect) {
        this.beforeConnect = beforeConnect;
        this.afterConnect = afterConnect;
        this.proxy = (CqlSession) Proxy.newProxyInstance(CqlSession.class.getClassLoader(),
                new Class<?>[] {CqlSession.class}, (target, method, args) -> invoke(method, args));
    }

    @Override
    public void afterPropertiesSet() {
        // Connecting is deferred to the first call on the session
    }

    @Override
    public CqlSession getObject() {
        return proxy;
    }

    @Override
    public void destroy() {
        if (session != null) {
            super.destroy();
        }
    }

    private Object invoke(Method method, Object[] args) throws Throwable {
        switch (method.getName()) {
            case "toString":
                return "Lazy CqlSession (" + (session == null ? "not connected" : session.getName()) + ")";
            case "hashCode":
                return System.identityHashCode(proxy);
            case "equals":
                return proxy == args[0];
            case "close":
            case "closeAsync":
            case "forceCloseAsync":
                // Closing a session that never connected must not connect it; the bean's destroy closes a real one
                if (session == null) {
                    return method.getReturnType() == void.class ? null : CompletableFuture.completedFuture(null);
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

    private CqlSession connected() {
        CqlSession current = session;
        if (current != null) {
            return current;
        }
        synchronized (this) {
            if (session == null) {
                beforeConnect.run();
                super.afterPropertiesSet();
                CqlSession connected = super.getObject();
                afterConnect.accept(connected);
                session = connected;
            }
            return session;
        }
    }
}
