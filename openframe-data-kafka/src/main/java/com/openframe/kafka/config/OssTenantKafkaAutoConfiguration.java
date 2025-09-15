package com.openframe.kafka.config;

import com.openframe.kafka.producer.OssTenantKafkaProducer;
import com.openframe.kafka.producer.OssTenantMessageProducer;
import com.openframe.kafka.producer.SaasMessageProducer;
import com.openframe.kafka.producer.StubSaasMessageProducer;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.apache.kafka.common.serialization.StringSerializer;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.core.*;
import org.springframework.kafka.listener.ContainerProperties;
import org.springframework.kafka.support.serializer.JsonDeserializer;
import org.springframework.kafka.support.serializer.JsonSerializer;

/**
 * Auto-configuration for main/OSS Kafka cluster using spring.oss-tenant prefix.
 * Creates all necessary beans for Kafka operations: Producer, Consumer, Admin, Streams.
 */
@AutoConfiguration
@EnableConfigurationProperties(OssTenantKafkaProperties.class)
public class OssTenantKafkaAutoConfiguration {

    /**
     * ProducerFactory for OSS cluster
     */
    @Bean("ossTenantKafkaProducerFactory")
    @ConditionalOnProperty(prefix = "spring.oss-tenant", name = "enabled", havingValue = "true", matchIfMissing = true)
    public ProducerFactory<String, Object> ossTenantKafkaProducerFactory(OssTenantKafkaProperties properties) {
        properties.getKafka().getProducer().setKeySerializer(StringSerializer.class);
        properties.getKafka().getProducer().setValueSerializer(JsonSerializer.class);
        var producerProperties = properties.getKafka().buildProducerProperties(null);
        return new DefaultKafkaProducerFactory<>(producerProperties);
    }

    /**
     * KafkaTemplate for OSS cluster
     */
    @Bean("ossTenantKafkaTemplate")
    @ConditionalOnProperty(prefix = "spring.oss-tenant", name = "enabled", havingValue = "true", matchIfMissing = true)
    public KafkaTemplate<String, Object> ossTenantKafkaTemplate(
            ProducerFactory<String, Object> ossTenantKafkaProducerFactory,
            OssTenantKafkaProperties properties) {
        var template = new KafkaTemplate<>(ossTenantKafkaProducerFactory);

        // Apply template settings from properties
        var templateProperties = properties.getKafka().getTemplate();
        if (templateProperties.getDefaultTopic() != null) {
            template.setDefaultTopic(templateProperties.getDefaultTopic());
        }

        return template;
    }

    /**
     * ConsumerFactory for OSS cluster
     */
    @Bean("ossTenantKafkaConsumerFactory")
    @ConditionalOnProperty(prefix = "spring.oss-tenant", name = "enabled", havingValue = "true", matchIfMissing = true)
    public ConsumerFactory<Object, Object> ossTenantKafkaConsumerFactory(OssTenantKafkaProperties properties) {
        properties.getKafka().getConsumer().setKeyDeserializer(StringDeserializer.class);
        properties.getKafka().getConsumer().setValueDeserializer(JsonDeserializer.class);
        var consumerProperties = properties.getKafka().buildConsumerProperties(null);
        return new DefaultKafkaConsumerFactory<>(consumerProperties);
    }

    /**
     * KafkaListenerContainerFactory for OSS cluster
     */
    @Bean("ossTenantKafkaListenerContainerFactory")
    @ConditionalOnProperty(prefix = "spring.oss-tenant", name = "enabled", havingValue = "true", matchIfMissing = true)
    public ConcurrentKafkaListenerContainerFactory<Object, Object> ossTenantKafkaListenerContainerFactory(
            ConsumerFactory<Object, Object> ossTenantKafkaConsumerFactory,
            OssTenantKafkaProperties properties) {

        var factory = new ConcurrentKafkaListenerContainerFactory<Object, Object>();
        factory.setConsumerFactory(ossTenantKafkaConsumerFactory);

        // Apply listener settings from properties
        var listenerProperties = properties.getKafka().getListener();

        if (listenerProperties.getConcurrency() != null) {
            factory.setConcurrency(listenerProperties.getConcurrency());
        }

        // Set ackMode with default fallback if not configured
        var ackMode = listenerProperties.getAckMode();
        if (ackMode != null) {
            factory.getContainerProperties().setAckMode(ackMode);
        } else {
            // Default to RECORD ackMode if not specified
            factory.getContainerProperties().setAckMode(ContainerProperties.AckMode.RECORD);
        }

        if (listenerProperties.getPollTimeout() != null) {
            factory.getContainerProperties().setPollTimeout(listenerProperties.getPollTimeout().toMillis());
        }

        if (listenerProperties.getIdleEventInterval() != null) {
            factory.getContainerProperties().setIdleEventInterval(listenerProperties.getIdleEventInterval().toMillis());
        }

        if (listenerProperties.getLogContainerConfig() != null) {
            factory.getContainerProperties().setLogContainerConfig(listenerProperties.getLogContainerConfig());
        }

        return factory;
    }

    /**
     * kafka producer for OSS cluster
     */
    @Bean("ossTenantMessageProducer")
    @ConditionalOnProperty(prefix = "spring.oss-tenant", name = "enabled", havingValue = "true", matchIfMissing = true)
    public OssTenantMessageProducer ossTenantMessageProducer(KafkaTemplate<String, Object> ossTenantKafkaTemplate) {
        return new OssTenantKafkaProducer(ossTenantKafkaTemplate);
    }

    /**
     * Default SaasMessageProducer implementation.
     * Always available regardless of spring.oss-tenant.enabled setting.
     * Only created if no other SaasMessageProducer bean exists (e.g., from SAAS module).
     */
    @Bean("saasMessageProducer")
    @ConditionalOnMissingBean(SaasMessageProducer.class)
    public SaasMessageProducer saasMessageProducer() {
        return new StubSaasMessageProducer();
    }
}
