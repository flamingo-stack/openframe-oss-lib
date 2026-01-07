package com.openframe.kafka.config;

import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;

@AutoConfiguration(after = OssTenantKafkaAutoConfiguration.class)
@EnableConfigurationProperties({KafkaTopicProperties.class, OssTenantKafkaProperties.class})
@ConditionalOnProperty(prefix = "spring.oss-tenant.kafka", name = "enabled", havingValue = "true")
public class KafkaTopicAutoConfiguration {

    @Bean
    public KafkaTopicInitializer kafkaTopicInitializer(
            OssTenantKafkaProperties ossTenantKafkaProperties,
            KafkaTopicProperties kafkaTopicProperties) {
        return new KafkaTopicInitializer(ossTenantKafkaProperties, kafkaTopicProperties);
    }
}
