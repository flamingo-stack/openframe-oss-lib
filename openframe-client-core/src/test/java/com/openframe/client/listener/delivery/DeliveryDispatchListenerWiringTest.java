package com.openframe.client.listener.delivery;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;
import com.openframe.client.service.delivery.LocalDeliverySink;
import com.openframe.delivery.dispatch.DeliveryDispatchMessage;
import com.openframe.delivery.metrics.DeliveryMetrics;
import com.openframe.delivery.spec.DeliveryAudience;
import com.openframe.delivery.spec.DeliverySpecRegistry;
import com.openframe.kafka.config.KafkaJsonSerdes;
import org.apache.kafka.common.header.Headers;
import org.apache.kafka.common.header.internals.RecordHeaders;
import org.apache.kafka.common.serialization.Deserializer;
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
import org.springframework.kafka.support.serializer.JacksonJsonDeserializer;

import java.time.Instant;
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
    private static final String TOPIC = "tenants.t1.delivery-dispatch";

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
    void context_sharedConsumerFactory_recordFromTheProducerReadBehindErrorHandling() {
        runner.run(context -> {
            ConcurrentKafkaListenerContainerFactory<?, ?> factory =
                    context.getBean(DeliveryDispatchListenerConfiguration.CONTAINER_FACTORY, ConcurrentKafkaListenerContainerFactory.class);
            ConsumerFactory<?, ?> consumerFactory = factory.getConsumerFactory();
            @SuppressWarnings("unchecked")
            Deserializer<Object> values = (Deserializer<Object>) consumerFactory.getValueDeserializer();
            assertThat(values).isInstanceOf(ErrorHandlingDeserializer.class);
            values.configure(consumerFactory.getConfigurationProperties(), false);

            Headers headers = new RecordHeaders();
            byte[] record = KafkaJsonSerdes.valueSerializer().serialize(TOPIC, headers, handOff());
            Object read = values.deserialize(TOPIC, headers, record);

            assertThat(read).isInstanceOf(DeliveryDispatchMessage.class);
            DeliveryDispatchMessage message = (DeliveryDispatchMessage) read;
            assertThat(message.getMachineId()).isEqualTo("mach-42");
            assertThat(message.getPayload().get("delivery").get("type").asString()).isEqualTo("CLIENT_FEATURE_FLAGS");
            assertThat(message.getNotBefore()).isNull();
        });
    }

    @Test
    void context_sharedConsumerFactory_scheduledHandOffKeepsItsMoment() {
        runner.run(context -> {
            ConcurrentKafkaListenerContainerFactory<?, ?> factory =
                    context.getBean(DeliveryDispatchListenerConfiguration.CONTAINER_FACTORY, ConcurrentKafkaListenerContainerFactory.class);
            ConsumerFactory<?, ?> consumerFactory = factory.getConsumerFactory();
            @SuppressWarnings("unchecked")
            Deserializer<Object> values = (Deserializer<Object>) consumerFactory.getValueDeserializer();
            values.configure(consumerFactory.getConfigurationProperties(), false);
            Instant notBefore = Instant.parse("2026-11-01T10:00:00.123Z");
            DeliveryDispatchMessage scheduled = handOff();
            scheduled.setNotBefore(notBefore);

            Headers headers = new RecordHeaders();
            byte[] record = KafkaJsonSerdes.valueSerializer().serialize(TOPIC, headers, scheduled);
            Object read = values.deserialize(TOPIC, headers, record);

            assertThat(read).isInstanceOf(DeliveryDispatchMessage.class);
            assertThat(((DeliveryDispatchMessage) read).getNotBefore()).isEqualTo(notBefore);
        });
    }

    private static DeliveryDispatchMessage handOff() {
        JsonNode payload = new JsonMapper().readTree("{\"delivery\":{\"type\":\"CLIENT_FEATURE_FLAGS\",\"targetId\":\"openframe-client\"},\"flags\":{}}");
        return new DeliveryDispatchMessage(DeliveryAudience.MACHINE, "mach-42", payload);
    }

    @Configuration
    static class Dependencies {

        // the factory the oss Kafka auto-configuration would provide: a plain JacksonJsonDeserializer and no broker to reach
        @Bean("ossTenantKafkaConsumerFactory")
        ConsumerFactory<Object, Object> ossTenantKafkaConsumerFactory() {
            return new DefaultKafkaConsumerFactory<>(Map.of(
                    BOOTSTRAP_SERVERS_CONFIG, "localhost:1",
                    KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class,
                    VALUE_DESERIALIZER_CLASS_CONFIG, JacksonJsonDeserializer.class,
                    JacksonJsonDeserializer.TRUSTED_PACKAGES, TRUSTED_PACKAGES));
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
            return new JsonMapper();
        }
    }
}
