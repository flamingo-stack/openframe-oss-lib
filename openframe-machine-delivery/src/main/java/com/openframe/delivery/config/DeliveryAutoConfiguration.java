package com.openframe.delivery.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.delivery.dispatch.DeliverySink;
import com.openframe.delivery.dispatch.KafkaDeliverySink;
import com.openframe.delivery.metrics.DeliveryMetrics;
import com.openframe.kafka.producer.OssTenantKafkaProducer;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;

@AutoConfiguration(afterName = "com.openframe.kafka.config.OssTenantKafkaAutoConfiguration")
@ComponentScan(basePackages = "com.openframe.delivery")
public class DeliveryAutoConfiguration {

    // the sink is chosen by what the service is built with: client-core brings LocalDeliverySink, every other
    // service with the tenant Kafka producer hands deliveries to client-service over Kafka. The producer is a
    // property condition, not a bean one: a service that component-scans com.openframe.delivery reads this class
    // before the Kafka auto-configuration has registered the producer, and a bean condition then finds nothing
    // (seen in management: no sink, the first rollout killed the start)
    @Configuration(proxyBeanMethods = false)
    @ConditionalOnClass(OssTenantKafkaProducer.class)
    static class KafkaHandOff {

        @Bean
        @ConditionalOnProperty({"openframe.delivery.dispatch-topic", "spring.oss-tenant.kafka.enabled"})
        @ConditionalOnMissingBean(DeliverySink.class)
        DeliverySink kafkaDeliverySink(OssTenantKafkaProducer producer, ObjectMapper objectMapper,
                                       DeliveryMetrics metrics, DeliveryProperties properties) {
            return new KafkaDeliverySink(producer, objectMapper, metrics, properties.getDispatchTopic());
        }
    }
}
