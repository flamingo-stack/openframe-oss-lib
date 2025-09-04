package com.openframe.kafka.config;

import com.openframe.kafka.producer.KafkaProducer;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.core.*;
import org.springframework.kafka.listener.ContainerProperties;

/**
 * Auto-configuration for main/OSS Kafka cluster using spring.oss-kafka prefix.
 * Creates all necessary beans for Kafka operations: Producer, Consumer, Admin, Streams.
 */
@AutoConfiguration
@EnableConfigurationProperties(OssKafkaProperties.class)
@ConditionalOnProperty(prefix = "spring.oss-kafka", name = "enabled", havingValue = "true", matchIfMissing = true)
public class OssKafkaAutoConfiguration {

    /**
     * ProducerFactory for OSS cluster
     */
    @Bean("ossKafkaProducerFactory")
    public ProducerFactory<String, Object> kafkaProducerFactory(OssKafkaProperties properties) {
        var producerProperties = properties.getKafka().buildProducerProperties(null);
        return new DefaultKafkaProducerFactory<>(producerProperties);
    }

    /**
     * KafkaTemplate for OSS cluster
     */
    @Bean("ossKafkaTemplate")
    public KafkaTemplate<String, Object> ossKafkaTemplate(
            ProducerFactory<String, Object> ossKafkaProducerFactory,
            OssKafkaProperties properties) {
        var template = new KafkaTemplate<>(ossKafkaProducerFactory);
        
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
    @Bean("ossKafkaConsumerFactory")
    public ConsumerFactory<Object, Object> ossKafkaConsumerFactory(OssKafkaProperties properties) {
        var consumerProperties = properties.getKafka().buildConsumerProperties(null);
        return new DefaultKafkaConsumerFactory<>(consumerProperties);
    }

    /**
     * KafkaListenerContainerFactory for OSS cluster
     */
    @Bean("kafkaListenerContainerFactory")
    public ConcurrentKafkaListenerContainerFactory<Object, Object> kafkaListenerContainerFactory(
            ConsumerFactory<Object, Object> ossKafkaConsumerFactory,
            OssKafkaProperties properties) {
        
        var factory = new ConcurrentKafkaListenerContainerFactory<Object, Object>();
        factory.setConsumerFactory(ossKafkaConsumerFactory);

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
     * GenericKafkaProducer for OSS cluster
     */
    @Bean("ossKafkaProducer")
    public KafkaProducer kafkaProducer(@Qualifier("ossKafkaTemplate") KafkaTemplate<String, Object> ossKafkaTemplate) {
        return new KafkaProducer(ossKafkaTemplate);
    }
}
