package com.openframe.kafka.config;

import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.kafka.KafkaAutoConfiguration;
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
    // This class enables @KafkaListener annotations to work
    // and automatically use the default "kafkaListenerContainerFactory" bean
}