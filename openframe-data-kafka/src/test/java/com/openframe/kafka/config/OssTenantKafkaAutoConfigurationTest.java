package com.openframe.kafka.config;

import org.junit.jupiter.api.Test;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.core.ProducerFactory;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

/**
 * Guards the observation contract: template and listener observation must stay
 * enabled so the traceparent header is propagated through Kafka records.
 */
class OssTenantKafkaAutoConfigurationTest {

    private final OssTenantKafkaAutoConfiguration config = new OssTenantKafkaAutoConfiguration();

    @Test
    @SuppressWarnings("unchecked")
    void templateHasObservationEnabled() {
        KafkaTemplate<String, Object> template = config.ossTenantKafkaTemplate(
                (ProducerFactory<String, Object>) mock(ProducerFactory.class),
                new OssTenantKafkaProperties());
        assertEquals(Boolean.TRUE, ReflectionTestUtils.getField(template, "observationEnabled"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void listenerFactoryHasObservationEnabled() {
        ConcurrentKafkaListenerContainerFactory<Object, Object> factory =
                config.ossTenantKafkaListenerContainerFactory(
                        (ConsumerFactory<Object, Object>) mock(ConsumerFactory.class),
                        new OssTenantKafkaProperties());
        assertTrue(factory.getContainerProperties().isObservationEnabled());
    }
}
