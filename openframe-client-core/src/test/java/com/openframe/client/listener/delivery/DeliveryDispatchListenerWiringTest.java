package com.openframe.client.listener.delivery;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.client.service.delivery.LocalDeliverySink;
import com.openframe.delivery.metrics.DeliveryMetrics;
import com.openframe.delivery.spec.DeliverySpecRegistry;
import org.apache.kafka.clients.consumer.Consumer;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.KafkaListenerEndpointRegistry;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.listener.MessageListenerContainer;

import java.util.Collection;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.RETURNS_MOCKS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

// client-service scans no package that carries @EnableKafka: the listener must bring its own, or @KafkaListener is
// silently ignored and the hand-off is never consumed
class DeliveryDispatchListenerWiringTest {

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

    @Configuration
    static class Dependencies {

        // the container starts with the context and asks the consumer for metrics and assignments: a mock that
        // answers with empty values keeps it alive without a broker
        @Bean("ossTenantKafkaConsumerFactory")
        @SuppressWarnings("unchecked")
        ConsumerFactory<Object, Object> ossTenantKafkaConsumerFactory() {
            Consumer<Object, Object> consumer = mock(Consumer.class, RETURNS_MOCKS);
            ConsumerFactory<Object, Object> factory = mock(ConsumerFactory.class, RETURNS_MOCKS);
            when(factory.createConsumer(any(), any(), any(), any())).thenReturn(consumer);
            return factory;
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
