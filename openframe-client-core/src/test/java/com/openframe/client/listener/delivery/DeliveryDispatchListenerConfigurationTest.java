package com.openframe.client.listener.delivery;

import com.openframe.delivery.metrics.DeliveryMetrics;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.dao.TransientDataAccessResourceException;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.listener.CommonErrorHandler;
import org.springframework.kafka.listener.ConcurrentMessageListenerContainer;
import org.springframework.kafka.listener.ContainerProperties.AckMode;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.util.backoff.BackOff;

import static com.openframe.client.listener.delivery.DeliveryDispatchListenerConfiguration.ANYTHING_ELSE;
import static com.openframe.client.listener.delivery.DeliveryDispatchListenerConfiguration.MONGO_UNREACHABLE;
import static com.openframe.client.listener.delivery.DeliveryDispatchListenerConfiguration.REJECTED_UNRECOVERABLE;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class DeliveryDispatchListenerConfigurationTest {

    private static final ConsumerRecord<Object, Object> RECORD = new ConsumerRecord<>("delivery.dispatch.t1", 0, 7L, "mach-42", "{}");

    @Mock private ConsumerFactory<Object, Object> consumerFactory;
    @Mock private DeliveryMetrics metrics;

    @InjectMocks private DeliveryDispatchListenerConfiguration configuration;

    @Test
    void containerFactory_acksPerRecordAndHandlesFailuresItself() {
        // setup
        ConcurrentKafkaListenerContainerFactory<Object, Object> factory = configuration.deliveryDispatchListenerContainerFactory(consumerFactory);

        // execution
        ConcurrentMessageListenerContainer<Object, Object> container = factory.createContainer("delivery.dispatch.t1");

        // verifications
        assertThat(container.getContainerProperties().getAckMode()).isEqualTo(AckMode.RECORD);
        CommonErrorHandler errorHandler = container.getCommonErrorHandler();
        assertThat(errorHandler).isInstanceOf(DefaultErrorHandler.class);
    }

    @Test
    void backOffFor_mongoUnreachable_retriesWithoutLimit() {
        // execution
        BackOff onConnectionLoss = configuration.backOffFor(RECORD, new DataAccessResourceFailureException("server selection timed out"));
        BackOff onTransientFailure = configuration.backOffFor(RECORD, new TransientDataAccessResourceException("primary stepped down"));

        // verifications
        assertThat(onConnectionLoss).isSameAs(MONGO_UNREACHABLE);
        assertThat(onTransientFailure).isSameAs(MONGO_UNREACHABLE);
    }

    @Test
    void backOffFor_anyOtherFailure_givesUpAfterAFewAttempts() {
        // execution
        BackOff onBug = configuration.backOffFor(RECORD, new NullPointerException("payload"));

        // verifications
        assertThat(onBug).isSameAs(ANYTHING_ELSE);
    }

    @Test
    void giveUp_countsTheSkippedRecord() {
        // execution
        configuration.giveUp(RECORD, new NullPointerException("payload"));

        // verifications
        verify(metrics).recordDispatchRejected(REJECTED_UNRECOVERABLE);
    }
}
