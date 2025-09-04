package com.openframe.kafka.config;

import com.openframe.kafka.producer.GenericKafkaProducer;
import com.openframe.kafka.producer.KafkaProducer;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.config.KafkaStreamsConfiguration;
import org.springframework.kafka.core.*;

/**
 * Auto-configuration for main/tenant Kafka cluster using standard spring.kafka prefix.
 * Creates all necessary beans for Kafka operations: Producer, Consumer, Admin, Streams.
 */
@AutoConfiguration
@EnableConfigurationProperties(TenantKafkaProperties.class)
@ConditionalOnProperty(prefix = "spring.kafka", name = "enabled", havingValue = "true", matchIfMissing = true)
public class TenantKafkaAutoConfiguration {

    /**
     * ProducerFactory for tenant cluster
     */
    @Bean("kafkaProducerFactory")
    public ProducerFactory<String, Object> kafkaProducerFactory(TenantKafkaProperties properties) {
        var producerProperties = properties.buildProducerProperties(null);
        return new DefaultKafkaProducerFactory<>(producerProperties);
    }

    /**
     * KafkaTemplate for tenant cluster
     */
    @Bean("kafkaTemplate")
    public KafkaTemplate<String, Object> kafkaTemplate(
            ProducerFactory<String, Object> kafkaProducerFactory,
            TenantKafkaProperties properties) {
        var template = new KafkaTemplate<>(kafkaProducerFactory);
        
        // Apply template settings from properties
        var templateProperties = properties.getTemplate();
        if (templateProperties.getDefaultTopic() != null) {
            template.setDefaultTopic(templateProperties.getDefaultTopic());
        }
        
        return template;
    }

    /**
     * ConsumerFactory for tenant cluster
     */
    @Bean("kafkaConsumerFactory")
    public ConsumerFactory<Object, Object> kafkaConsumerFactory(TenantKafkaProperties properties) {
        var consumerProperties = properties.buildConsumerProperties(null);
        return new DefaultKafkaConsumerFactory<>(consumerProperties);
    }

    /**
     * KafkaListenerContainerFactory for tenant cluster
     */
    @Bean("kafkaListenerContainerFactory")
    public ConcurrentKafkaListenerContainerFactory<Object, Object> kafkaListenerContainerFactory(
            ConsumerFactory<Object, Object> kafkaConsumerFactory,
            TenantKafkaProperties properties) {
        
        var factory = new ConcurrentKafkaListenerContainerFactory<Object, Object>();
        factory.setConsumerFactory(kafkaConsumerFactory);

        // Apply listener settings from properties
        var listenerProperties = properties.getListener();
        
        if (listenerProperties.getConcurrency() != null) {
            factory.setConcurrency(listenerProperties.getConcurrency());
        }
        
        factory.getContainerProperties().setAckMode(listenerProperties.getAckMode());
        
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
     * GenericKafkaProducer for tenant cluster
     */
    @Bean("kafkaProducer")
    public KafkaProducer kafkaProducer(@Qualifier("kafkaTemplate") KafkaTemplate<String, Object> kafkaTemplate) {
        return new KafkaProducer(kafkaTemplate);
    }
}
