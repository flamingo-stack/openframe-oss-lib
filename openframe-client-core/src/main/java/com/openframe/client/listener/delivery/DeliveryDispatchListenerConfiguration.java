package com.openframe.client.listener.delivery;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.listener.ContainerProperties.AckMode;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.util.backoff.FixedBackOff;

@Configuration
@ConditionalOnExpression("'${spring.oss-tenant.kafka.enabled:false}' == 'true' && '${openframe.delivery.dispatch-topic:}' != ''")
public class DeliveryDispatchListenerConfiguration {

    static final String CONTAINER_FACTORY = "deliveryDispatchListenerContainerFactory";
    private static final long RETRY_INTERVAL_MS = 5_000L;

    // the row must reach Mongo before the record is acked: the same record is retried until it does, instead of the
    // shared factory's ten quick attempts and a silent skip; a malformed message is skipped by the listener itself
    @Bean(CONTAINER_FACTORY)
    public ConcurrentKafkaListenerContainerFactory<Object, Object> deliveryDispatchListenerContainerFactory(
            @Qualifier("ossTenantKafkaConsumerFactory") ConsumerFactory<Object, Object> consumerFactory) {
        ConcurrentKafkaListenerContainerFactory<Object, Object> factory = new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(consumerFactory);
        factory.getContainerProperties().setAckMode(AckMode.RECORD);
        FixedBackOff untilItWorks = new FixedBackOff(RETRY_INTERVAL_MS, FixedBackOff.UNLIMITED_ATTEMPTS);
        factory.setCommonErrorHandler(new DefaultErrorHandler(untilItWorks));
        return factory;
    }
}
