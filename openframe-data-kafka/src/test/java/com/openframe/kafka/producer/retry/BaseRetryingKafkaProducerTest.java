package com.openframe.kafka.producer.retry;

import com.openframe.kafka.exception.NonRetryableKafkaException;
import com.openframe.kafka.exception.TransientKafkaSendException;
import com.openframe.kafka.model.KafkaMessage;
import com.openframe.kafka.producer.MessageProducer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.retry.annotation.EnableRetry;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

// Runs inside a context with @EnableRetry, as every app has now: a failed send must reach the caller once, unchanged.
class BaseRetryingKafkaProducerTest {

    private static final String TOPIC = "tenants.t1.user-events.from-tenant";
    private static final String KEY = "machine-42";
    private static final Map<String, Object> HEADERS = Map.of("message-type", "MACHINE_STUCK");

    private final KafkaMessage message = mock(KafkaMessage.class);

    private AnnotationConfigApplicationContext context;
    private MessageProducer messageProducer;
    private KafkaRecoveryHandler recoveryHandler;
    private BaseRetryingKafkaProducer producer;

    @BeforeEach
    void setUp() {
        context = new AnnotationConfigApplicationContext(RetryEnabledConfiguration.class);
        messageProducer = context.getBean(MessageProducer.class);
        recoveryHandler = context.getBean(KafkaRecoveryHandler.class);
        producer = context.getBean(BaseRetryingKafkaProducer.class);
    }

    @AfterEach
    void tearDown() {
        context.close();
    }

    @Test
    @DisplayName("Given a transient send failure, when a message is published, then the caller gets the same exception after one attempt and nothing is recovered")
    void transientFailureReachesTheCallerAfterOneAttempt() {
        TransientKafkaSendException failure = new TransientKafkaSendException("broker down", null);
        doThrow(failure).when(messageProducer).sendAndAwaitMessage(TOPIC, message, KEY);

        assertThatThrownBy(() -> producer.publish(TOPIC, KEY, message)).isSameAs(failure);

        verify(messageProducer, times(1)).sendAndAwaitMessage(TOPIC, message, KEY);
        verifyNoInteractions(recoveryHandler);
    }

    @Test
    @DisplayName("Given a fatal send failure with headers, when a message is published, then the caller gets the same exception after one attempt and nothing is recovered")
    void fatalFailureWithHeadersReachesTheCallerAfterOneAttempt() {
        NonRetryableKafkaException failure = new NonRetryableKafkaException("record too large", null);
        doThrow(failure).when(messageProducer).sendAndAwaitMessage(TOPIC, message, KEY, HEADERS);

        assertThatThrownBy(() -> producer.publish(TOPIC, KEY, message, HEADERS)).isSameAs(failure);

        verify(messageProducer, times(1)).sendAndAwaitMessage(TOPIC, message, KEY, HEADERS);
        verifyNoInteractions(recoveryHandler);
    }

    @Test
    @DisplayName("Given a working broker, when a message is published, then it is sent once with its topic, key and headers")
    void successfulSendIsDelegatedOnce() {
        producer.publish(TOPIC, KEY, message, HEADERS);

        verify(messageProducer, times(1)).sendAndAwaitMessage(TOPIC, message, KEY, HEADERS);
    }

    @Configuration
    @EnableRetry
    static class RetryEnabledConfiguration {

        @Bean
        MessageProducer messageProducer() {
            return mock(MessageProducer.class);
        }

        @Bean
        KafkaRecoveryHandler recoveryHandler() {
            return mock(KafkaRecoveryHandler.class);
        }

        @Bean
        BaseRetryingKafkaProducer producer(MessageProducer messageProducer, KafkaRecoveryHandler recoveryHandler) {
            return new BaseRetryingKafkaProducer(messageProducer, recoveryHandler) {
            };
        }
    }
}
