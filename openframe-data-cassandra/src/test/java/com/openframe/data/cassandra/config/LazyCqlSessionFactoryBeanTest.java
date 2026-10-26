package com.openframe.data.cassandra.config;

import com.datastax.oss.driver.api.core.CqlSession;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LazyCqlSessionFactoryBeanTest {

    private final AtomicInteger connectAttempts = new AtomicInteger();
    private LazyCqlSessionFactoryBean factory;

    @BeforeEach
    void setUp() {
        factory = new LazyCqlSessionFactoryBean(connectAttempts::incrementAndGet, session -> { });
        // Nothing listens on port 1: any connection attempt fails
        factory.setContactPoints("127.0.0.1");
        factory.setPort(1);
        factory.setLocalDatacenter("datacenter1");
        factory.setKeyspaceName("of_lazy_session_test");
    }

    @AfterEach
    void tearDown() {
        factory.destroy();
    }

    @Test
    void afterPropertiesSet_noCassandra_createsTheBeanWithoutConnecting() {
        factory.afterPropertiesSet();

        CqlSession session = factory.getObject();

        assertThat(session).isNotNull();
        assertThat(session.toString()).contains("not connected");
        assertThat(connectAttempts).hasValue(0);
    }

    @Test
    void close_neverConnected_doesNotConnect() {
        factory.afterPropertiesSet();
        CqlSession session = factory.getObject();

        assertThatCode(session::close).doesNotThrowAnyException();
        assertThatCode(() -> session.closeAsync().toCompletableFuture().join()).doesNotThrowAnyException();
        assertThat(connectAttempts).hasValue(0);
    }

    @Test
    void firstUse_noCassandra_connectsAndFails() {
        factory.afterPropertiesSet();
        CqlSession session = factory.getObject();

        assertThatThrownBy(session::getMetadata).isInstanceOf(RuntimeException.class);
        assertThat(connectAttempts).hasValue(1);
    }
}
