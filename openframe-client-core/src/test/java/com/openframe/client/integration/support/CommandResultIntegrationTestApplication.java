package com.openframe.client.integration.support;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.client.listener.CommandResultListener;
import com.openframe.client.service.CommandResultService;
import com.openframe.client.service.NatsTopicMachineIdExtractor;
import com.openframe.kafka.producer.retry.OssTenantRetryingKafkaProducer;
import io.nats.client.Connection;
import io.nats.client.Nats;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.support.PropertySourcesPlaceholderConfigurer;

/**
 * Minimal Spring context for the {@link CommandResultListener} integration test.
 *
 * <p>Deliberately avoids {@code @EnableAutoConfiguration} so that the Mongo /
 * Cassandra / Redis machinery pulled in transitively by {@code client-core}
 * does not try to connect. Only the beans on the command-result NATS→Kafka path
 * are wired; the Kafka producer boundary is a Mockito mock so the test needs a
 * NATS broker but not a Kafka broker.
 */
@SpringBootConfiguration
@Import({
        CommandResultListener.class,
        CommandResultService.class,
        NatsTopicMachineIdExtractor.class
})
public class CommandResultIntegrationTestApplication {

    @Bean(destroyMethod = "close")
    public Connection natsConnection(@Value("${nats.spring.server}") String server) throws Exception {
        return Nats.connect(server);
    }

    @Bean
    public ObjectMapper objectMapper() {
        return new ObjectMapper();
    }

    @Bean
    public OssTenantRetryingKafkaProducer ossTenantRetryingKafkaProducer() {
        return Mockito.mock(OssTenantRetryingKafkaProducer.class);
    }

    @Bean
    public static PropertySourcesPlaceholderConfigurer propertySourcesPlaceholderConfigurer() {
        return new PropertySourcesPlaceholderConfigurer();
    }
}
