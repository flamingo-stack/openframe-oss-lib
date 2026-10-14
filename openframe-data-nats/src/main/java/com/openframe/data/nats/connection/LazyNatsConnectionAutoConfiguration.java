package com.openframe.data.nats.connection;

import io.nats.client.Connection;
import io.nats.client.ConnectionListener;
import io.nats.client.ErrorListener;
import io.nats.client.Options;
import io.nats.spring.boot.autoconfigure.NatsAutoConfiguration;
import io.nats.spring.boot.autoconfigure.NatsProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Conditional;
import org.springframework.util.StringUtils;

/**
 * Replaces the {@code natsConnection} of {@link NatsAutoConfiguration}, which connects while the bean is created
 * (its bean backs off, being {@code @ConditionalOnMissingBean}). Same options from {@code nats.spring.*}, same
 * listeners, and like it no connection when no server is set. Off when {@link NatsAutoConfiguration} is excluded.
 */
@Slf4j
@AutoConfiguration(before = NatsAutoConfiguration.class)
@ConditionalOnClass({Connection.class, NatsAutoConfiguration.class})
@Conditional(OnNatsAutoConfigurationNotExcluded.class)
@EnableConfigurationProperties(NatsProperties.class)
public class LazyNatsConnectionAutoConfiguration {

    @Bean
    public Connection natsConnection(NatsProperties properties,
                                     ObjectProvider<ConnectionListener> connectionListener,
                                     ObjectProvider<ErrorListener> errorListener) {
        if (!StringUtils.hasLength(properties.getServer())) {
            return null;
        }
        return LazyNatsConnection.create(() -> {
            log.info("Connecting to NATS: {}", properties.getServer());
            try {
                Options.Builder builder = properties.toOptionsBuilder();
                connectionListener.ifAvailable(builder::connectionListener);
                errorListener.ifAvailable(builder::errorListener);
                return builder.build();
            } catch (Exception e) {
                throw new IllegalStateException("Invalid NATS options", e);
            }
        });
    }

    @Bean
    NatsConnectionStarter natsConnectionStarter(ObjectProvider<Connection> natsConnection) {
        return new NatsConnectionStarter(natsConnection);
    }
}
