package com.openframe.kafka.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.kafka.KafkaAutoConfiguration;
import org.springframework.kafka.annotation.EnableKafka;

/**
 * Excludes default KafkaAutoConfiguration to use custom configurations.
 */
@EnableKafka
@EnableAutoConfiguration(exclude = {KafkaAutoConfiguration.class})
public class OssKafkaConfig {

}
