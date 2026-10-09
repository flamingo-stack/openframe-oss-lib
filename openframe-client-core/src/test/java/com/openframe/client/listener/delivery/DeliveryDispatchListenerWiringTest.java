package com.openframe.client.listener.delivery;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.client.service.delivery.LocalDeliverySink;
import com.openframe.delivery.metrics.DeliveryMetrics;
import com.openframe.delivery.spec.DeliverySpecRegistry;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.config.KafkaListenerEndpointRegistry;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.core.DefaultKafkaConsumerFactory;
import org.springframework.kafka.listener.MessageListenerContainer;
import org.springframework.kafka.support.serializer.ErrorHandlingDeserializer;
import org.springframework.kafka.support.serializer.JsonDeserializer;

import java.util.Collection;
import java.util.Map;

import static org.apache.kafka.clients.consumer.ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG;
import static org.apache.kafka.clients.consumer.ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG;
import static org.apache.kafka.clients.consumer.ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

// client-service scans no package that carries @EnableKafka: the listener must bring its own, or @KafkaListener is
// silently ignored and the hand-off is never consumed
class DeliveryDispatchListenerWiringTest {

    private static final String TRUSTED_PACKAGES = "com.openframe.delivery.dispatch";

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withPropertyValues(
                    "spring.oss-tenant.kafka.enabled=true",
                    "openframe.delivery.dispatch-topic=tenants.t1.delivery-dispatch",
                    "openframe.delivery.dispatch-group=client-delivery-dispatch-t1")
            .withUserConfiguration(Dependencies.class, DeliveryDispatchListenerConfiguration.class, DeliveryDispatchListener.class);

    @Test
    void context_listenerAndItsFactoryOnly_listenerContainerRegistered() {
        runner.run(context -> {
            KafkaListenerEndpointRegistry registry = context.getBean(KafkaListenerEndpointRegistry.class);
            Collection<MessageListenerContainer> containers = registry.getListenerContainers();
            assertThat(containers).hasSize(1);
            MessageListenerContainer container = containers.iterator().next();
            assertThat(container.getGroupId()).isEqualTo("client-delivery-dispatch-t1");
            assertThat(container.getContainerProperties().getTopics()).containsExactly("tenants.t1.delivery-dispatch");
        });
    }

    @Test
    void context_sharedConsumerFactory_valuesDeserializedBehindErrorHandling() {
        runner.run(context -> {
            ConcurrentKafkaListenerContainerFactory<?, ?> factory =
                    context.getBean(DeliveryDispatchListenerConfiguration.CONTAINER_FACTORY, ConcurrentKafkaListenerContainerFactory.class);
            Map<String, Object> consumerConfig = factory.getConsumerFactory().getConfigurationProperties();
            assertThat(consumerConfig)
                    .containsEntry(VALUE_DESERIALIZER_CLASS_CONFIG, ErrorHandlingDeserializer.class)
                    .containsEntry(ErrorHandlingDeserializer.VALUE_DESERIALIZER_CLASS, JsonDeserializer.class)
                    .containsEntry(JsonDeserializer.TRUSTED_PACKAGES, TRUSTED_PACKAGES);
        });
    }

    @Configuration
    static class Dependencies {

        // the factory the oss Kafka auto-configuration would provide: a plain JsonDeserializer and no broker to reach
        @Bean("ossTenantKafkaConsumerFactory")
        ConsumerFactory<Object, Object> ossTenantKafkaConsumerFactory() {
            return new DefaultKafkaConsumerFactory<>(Map.of(
                    BOOTSTRAP_SERVERS_CONFIG, "localhost:1",
                    KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class,
                    VALUE_DESERIALIZER_CLASS_CONFIG, JsonDeserializer.class,
                    JsonDeserializer.TRUSTED_PACKAGES, TRUSTED_PACKAGES));
        }

        @Bean
        DeliveryMetrics deliveryMetrics() {
            return mock(DeliveryMetrics.class);
        }

        @Bean
        DeliverySpecRegistry deliverySpecRegistry() {
            return mock(DeliverySpecRegistry.class);
        }

        @Bean
        LocalDeliverySink localDeliverySink() {
            return mock(LocalDeliverySink.class);
        }

        @Bean
        ObjectMapper objectMapper() {
            return new ObjectMapper();
        }
    }
}
