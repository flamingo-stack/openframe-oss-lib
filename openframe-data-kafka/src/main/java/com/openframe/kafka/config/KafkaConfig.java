package com.openframe.kafka.config;

import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.kafka.KafkaAutoConfiguration;
import org.springframework.kafka.annotation.EnableKafka;

/**
 * Global Kafka configuration.
 * Enables Kafka listeners with default container factory configuration.
 * Excludes default KafkaAutoConfiguration to use custom configurations.
 */
@AutoConfiguration
@EnableKafka
@EnableAutoConfiguration(exclude = {KafkaAutoConfiguration.class})
public class KafkaConfig {
    // This class is needed to exclude KafkaAutoConfiguration
    // and enable custom Kafka configurations
}
