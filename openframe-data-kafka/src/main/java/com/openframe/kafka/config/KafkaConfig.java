package com.openframe.kafka.config;

import com.openframe.kafka.producer.SaasMessageProducer;
import com.openframe.kafka.producer.StubSaasMessageProducer;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.kafka.KafkaAutoConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.annotation.EnableKafka;

/**
 * Global Kafka configuration.
 * Enables Kafka listeners with default container factory configuration.
 */
@Configuration
@EnableKafka
@EnableAutoConfiguration(exclude = {KafkaAutoConfiguration.class})
public class KafkaConfig {

    /**
     * Stub SaasMessageProducer for OSS version
     */
    @Bean("saasMessageProducer")
    public SaasMessageProducer saasMessageProducer() {
        return new StubSaasMessageProducer();
    }

}