package com.openframe.client.listener.delivery;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.listener.CommonErrorHandler;
import org.springframework.kafka.listener.ConcurrentMessageListenerContainer;
import org.springframework.kafka.listener.ContainerProperties.AckMode;
import org.springframework.kafka.listener.DefaultErrorHandler;

import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(MockitoExtension.class)
class DeliveryDispatchListenerConfigurationTest {

    @Mock private ConsumerFactory<Object, Object> consumerFactory;

    private final DeliveryDispatchListenerConfiguration configuration = new DeliveryDispatchListenerConfiguration();

    @Test
    void containerFactory_acksPerRecordAndRetriesTheRecordInsteadOfSkippingIt() {
        // setup
        ConcurrentKafkaListenerContainerFactory<Object, Object> factory = configuration.deliveryDispatchListenerContainerFactory(consumerFactory);

        // execution
        ConcurrentMessageListenerContainer<Object, Object> container = factory.createContainer("delivery.dispatch.t1");

        // verifications
        assertThat(container.getContainerProperties().getAckMode()).isEqualTo(AckMode.RECORD);
        CommonErrorHandler errorHandler = container.getCommonErrorHandler();
        assertThat(errorHandler).isInstanceOf(DefaultErrorHandler.class);
    }
}
