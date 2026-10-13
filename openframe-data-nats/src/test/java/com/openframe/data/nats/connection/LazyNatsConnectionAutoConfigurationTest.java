package com.openframe.data.nats.connection;

import io.nats.client.Connection;
import io.nats.client.Options;
import io.nats.spring.boot.autoconfigure.NatsAutoConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.utility.DockerImageName;

import java.io.UncheckedIOException;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

class LazyNatsConnectionAutoConfigurationTest {

    // Nothing listens on port 1
    private static final String UNREACHABLE = "nats://127.0.0.1:1";

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(LazyNatsConnectionAutoConfiguration.class, NatsAutoConfiguration.class))
            .withPropertyValues("nats.spring.connection-timeout=500ms", "nats.spring.max-reconnect=0");

    @Test
    void create_noNatsReachable_doesNotConnectUntilUsed() {
        AtomicInteger connects = new AtomicInteger();
        Connection connection = LazyNatsConnection.create(() -> {
            connects.incrementAndGet();
            return Options.builder().server(UNREACHABLE).build();
        });

        assertThat(connection.toString()).isEqualTo(LazyNatsConnection.NOT_CONNECTED);
        assertThatCode(connection::close).doesNotThrowAnyException();
        assertThat(connects).hasValue(0);
    }

    @Test
    void refresh_noNatsReachable_onlyTheStarterFails() {
        // Every bean, the connection included, is created without NATS; only the start in the lowest phase connects
        runner.withPropertyValues("nats.spring.server=" + UNREACHABLE).run(context -> {
            assertThat(context).hasFailed();
            assertThat(context.getStartupFailure())
                    .hasMessageContaining("Failed to start bean 'natsConnectionStarter'")
                    .hasRootCauseInstanceOf(java.io.IOException.class)
                    .cause().isInstanceOf(UncheckedIOException.class);
        });
    }

    @Test
    void start_natsUp_connects() {
        try (GenericContainer<?> nats = new GenericContainer<>(DockerImageName.parse("nats:2.10-alpine"))
                .withExposedPorts(4222)
                .waitingFor(Wait.forLogMessage(".*Server is ready.*", 1))) {
            nats.start();
            String server = "nats://" + nats.getHost() + ":" + nats.getMappedPort(4222);

            runner.withPropertyValues("nats.spring.server=" + server).run(context -> {
                assertThat(context).hasNotFailed();
                assertThat(context.getBean(Connection.class).getStatus()).isEqualTo(Connection.Status.CONNECTED);
            });
        }
    }

    @Test
    void natsAutoConfigurationExcluded_noConnectionEvenWithAServerSet() {
        new ApplicationContextRunner()
                .withUserConfiguration(ExcludesNats.class)
                .withPropertyValues("nats.spring.server=" + UNREACHABLE)
                .run(context -> {
                    assertThat(context).hasNotFailed().doesNotHaveBean(Connection.class).doesNotHaveBean(NatsConnectionStarter.class);
                });
    }

    @Configuration(proxyBeanMethods = false)
    @ImportAutoConfiguration(classes = {LazyNatsConnectionAutoConfiguration.class, NatsAutoConfiguration.class},
            exclude = NatsAutoConfiguration.class)
    static class ExcludesNats {
    }

    @Test
    void noServerSet_noConnectionAndNothingFails() {
        runner.run(context -> {
            assertThat(context).hasNotFailed();
            assertThat(context.getBeanProvider(Connection.class).getIfAvailable()).isNull();
        });
    }
}
