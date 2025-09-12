package com.openframe.kafka.config;

import com.openframe.kafka.producer.SaasKafkaProducer;
import com.openframe.kafka.producer.SaasMessageProducer;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.core.*;
import org.springframework.kafka.listener.ContainerProperties;

/**
 * Autoconfiguration for saas Kafka cluster using spring.kafka.saas prefix.
 * Creates all necessary beans for Kafka operations: Producer, Consumer, Admin, Streams.
 * Activated only when spring.kafka.saas.bootstrap-servers is configured.
 */
@AutoConfiguration
@EnableConfigurationProperties(SaasKafkaProperties.class)
@ConditionalOnProperty(prefix = "spring.saas", name = "enabled", havingValue = "true")
public class SaasKafkaAutoConfiguration {

    /**
     * ProducerFactory for saas cluster
     */
    @Bean("saasKafkaProducerFactory")
    public ProducerFactory<String, Object> saasKafkaProducerFactory(SaasKafkaProperties properties) {
        var producerProperties = properties.getKafka().buildProducerProperties(null);
        return new DefaultKafkaProducerFactory<>(producerProperties);
    }

    /**
     * KafkaTemplate for saas cluster
     */
    @Bean("saasKafkaTemplate")
    public KafkaTemplate<String, Object> saasKafkaTemplate(
            ProducerFactory<String, Object> saasKafkaProducerFactory,
            SaasKafkaProperties properties) {
        var template = new KafkaTemplate<>(saasKafkaProducerFactory);
        
        // Apply template settings from properties
        var templateProperties = properties.getKafka().getTemplate();
        if (templateProperties.getDefaultTopic() != null) {
            template.setDefaultTopic(templateProperties.getDefaultTopic());
        }
        
        return template;
    }

    /**
     * ConsumerFactory for saas cluster
     */
    @Bean("saasKafkaConsumerFactory")
    public ConsumerFactory<Object, Object> saasKafkaConsumerFactory(SaasKafkaProperties properties) {
        var consumerProperties = properties.getKafka().buildConsumerProperties(null);
        return new DefaultKafkaConsumerFactory<>(consumerProperties);
    }

    /**
     * KafkaListenerContainerFactory for saas cluster
     */
    @Bean("saasKafkaListenerContainerFactory")
    public ConcurrentKafkaListenerContainerFactory<Object, Object> saasKafkaListenerContainerFactory(
            ConsumerFactory<Object, Object> saasKafkaConsumerFactory,
            SaasKafkaProperties properties) {
        
        var factory = new ConcurrentKafkaListenerContainerFactory<Object, Object>();
        factory.setConsumerFactory(saasKafkaConsumerFactory);

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
     * GenericKafkaProducer for saas cluster
     */
    @Bean("saasMessageProducer")
    public SaasMessageProducer saasMessageProducer(KafkaTemplate<String, Object> saasKafkaTemplate) {
        return new SaasKafkaProducer(saasKafkaTemplate);
    }
}
