package com.openframe.kafka.config;

import com.openframe.kafka.producer.SharedKafkaProducer;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.core.*;
import org.springframework.kafka.listener.ContainerProperties;

/**
 * Autoconfiguration for shared Kafka cluster using spring.kafka.shared prefix.
 * Creates all necessary beans for Kafka operations: Producer, Consumer, Admin, Streams.
 * Activated only when spring.kafka.shared.bootstrap-servers is configured.
 */
@AutoConfiguration
@EnableConfigurationProperties(SharedKafkaProperties.class)
@ConditionalOnProperty(prefix = "spring.shared-cluster", name = "bootstrap-servers")
public class SharedKafkaAutoConfiguration {

    /**
     * ProducerFactory for shared cluster
     */
    @Bean("sharedKafkaProducerFactory")
    public ProducerFactory<String, Object> sharedKafkaProducerFactory(SharedKafkaProperties properties) {
        var producerProperties = properties.getKafka().buildProducerProperties(null);
        return new DefaultKafkaProducerFactory<>(producerProperties);
    }

    /**
     * KafkaTemplate for shared cluster
     */
    @Bean("sharedKafkaTemplate")
    public KafkaTemplate<String, Object> sharedKafkaTemplate(
            ProducerFactory<String, Object> sharedKafkaProducerFactory,
            SharedKafkaProperties properties) {
        var template = new KafkaTemplate<>(sharedKafkaProducerFactory);
        
        // Apply template settings from properties
        var templateProperties = properties.getKafka().getTemplate();
        if (templateProperties.getDefaultTopic() != null) {
            template.setDefaultTopic(templateProperties.getDefaultTopic());
        }
        
        return template;
    }

    /**
     * ConsumerFactory for shared cluster
     */
    @Bean("sharedKafkaConsumerFactory")
    public ConsumerFactory<Object, Object> sharedKafkaConsumerFactory(SharedKafkaProperties properties) {
        var consumerProperties = properties.getKafka().buildConsumerProperties(null);
        return new DefaultKafkaConsumerFactory<>(consumerProperties);
    }

    /**
     * KafkaListenerContainerFactory for shared cluster
     */
    @Bean("sharedKafkaListenerContainerFactory")
    public ConcurrentKafkaListenerContainerFactory<Object, Object> sharedKafkaListenerContainerFactory(
            ConsumerFactory<Object, Object> sharedKafkaConsumerFactory,
            SharedKafkaProperties properties) {
        
        var factory = new ConcurrentKafkaListenerContainerFactory<Object, Object>();
        factory.setConsumerFactory(sharedKafkaConsumerFactory);

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
            // Default to BATCH ackMode if not specified
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
     * GenericKafkaProducer for shared cluster
     */
    @Bean("sharedKafkaProducer")
    public SharedKafkaProducer sharedKafkaProducer(@Qualifier("sharedKafkaTemplate") KafkaTemplate<String, Object> sharedKafkaTemplate) {
        return new SharedKafkaProducer(sharedKafkaTemplate);
    }
}
