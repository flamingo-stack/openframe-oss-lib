package com.openframe.kafka.listener;

import org.apache.kafka.clients.consumer.Consumer;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.core.DefaultKafkaConsumerFactory;
import org.springframework.kafka.core.KafkaOperations;
import org.springframework.kafka.listener.ConsumerAwareRecordRecoverer;
import org.springframework.kafka.listener.ContainerProperties;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.kafka.support.serializer.ErrorHandlingDeserializer;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.util.backoff.BackOff;
import org.springframework.util.backoff.BackOffExecution;
import org.springframework.util.backoff.FixedBackOff;

import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.function.BiFunction;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// A listener container factory with retries and a dead-letter topic, built on any consumer factory, so a consumer
// picks it by name and configures nothing of its own.
class RetryingListenerContainerFactoriesTest {

    private static final String TOPIC = "tenants.cluster-1.email-inbound.to-tenant";

    @SuppressWarnings("unchecked")
    private final KafkaOperations<String, byte[]> bytes = mock(KafkaOperations.class);
    @SuppressWarnings("unchecked")
    private final KafkaOperations<Object, Object> objects = mock(KafkaOperations.class);

    @Test
    void deadLetterTopic_isTheTopicWithTheDltSuffix() {
        // execution and verifications
        assertThat(DeadLetterTopics.of(TOPIC)).isEqualTo(TOPIC + "-dlt");
        assertThat(DeadLetterTopics.SUFFIX).isEqualTo("-dlt");
    }

    @Test
    void create_copiesTheBaseConfig_valuesThroughAnErrorHandlingDeserializer() {
        // execution
        ConcurrentKafkaListenerContainerFactory<Object, Object> factory = factory(ClassifyingRetryPolicy.defaults());

        // verifications
        ConsumerFactory<? super Object, ? super Object> consumers = factory.getConsumerFactory();
        assertThat(consumers.getConfigurationProperties())
                .containsEntry(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092");
        assertThat(((DefaultKafkaConsumerFactory<?, ?>) consumers).getValueDeserializer())
                .isInstanceOf(ErrorHandlingDeserializer.class);
        assertThat(((DefaultKafkaConsumerFactory<?, ?>) consumers).getKeyDeserializer())
                .isInstanceOf(StringDeserializer.class);
    }

    @Test
    void create_acksPerRecord_withADefaultErrorHandler() {
        // execution
        ConcurrentKafkaListenerContainerFactory<Object, Object> factory = factory(ClassifyingRetryPolicy.defaults());

        // verifications
        assertThat(factory.getContainerProperties().getAckMode()).isEqualTo(ContainerProperties.AckMode.RECORD);
        assertThat(ReflectionTestUtils.getField(factory, "commonErrorHandler")).isInstanceOf(DefaultErrorHandler.class);
    }

    @Test
    @SuppressWarnings("unchecked")
    void errorHandler_asksThePolicyForEachFailure() {
        // setup
        FixedBackOff given = new FixedBackOff(42L, 1L);
        ConsumerRetryPolicy policy = (record, failure) -> given;
        Object handler = ReflectionTestUtils.getField(factory(policy), "commonErrorHandler");
        BiFunction<ConsumerRecord<?, ?>, Exception, BackOff> function =
                (BiFunction<ConsumerRecord<?, ?>, Exception, BackOff>) ReflectionTestUtils.getField(handler,
                        "userBackOffFunction");

        // execution
        BackOffExecution execution = function.apply(record("{}"), new IllegalStateException()).start();

        // verifications
        assertThat(execution.nextBackOff()).isEqualTo(42L);
    }

    @Test
    @SuppressWarnings("unchecked")
    void recoverer_objectValue_toTheObjectTemplate_onTheDeadLetterTopic() {
        // setup
        when(objects.send(any(ProducerRecord.class))).thenReturn(CompletableFuture.completedFuture(null));

        // execution
        recoverer(factory(ClassifyingRetryPolicy.defaults()))
                .accept(record("{\"eventType\":\"X\"}"), mock(Consumer.class), new IllegalStateException("boom"));

        // verifications
        ArgumentCaptor<ProducerRecord<Object, Object>> sent = ArgumentCaptor.forClass(ProducerRecord.class);
        verify(objects).send(sent.capture());
        verify(bytes, never()).send(any(ProducerRecord.class));
        assertThat(sent.getValue().topic()).isEqualTo(TOPIC + "-dlt");
        assertThat(sent.getValue().value()).isEqualTo("{\"eventType\":\"X\"}");
    }

    @Test
    @SuppressWarnings("unchecked")
    void recoverer_rawBytes_toTheBytesTemplate_unchanged() {
        // setup
        when(bytes.send(any(ProducerRecord.class))).thenReturn(CompletableFuture.completedFuture(null));
        byte[] raw = {1, 2, 3};

        // execution
        recoverer(factory(ClassifyingRetryPolicy.defaults()))
                .accept(new ConsumerRecord<>(TOPIC, 0, 7L, "mailbox-1", raw), mock(Consumer.class),
                        new IllegalStateException("bad"));

        // verifications
        ArgumentCaptor<ProducerRecord<String, byte[]>> sent = ArgumentCaptor.forClass(ProducerRecord.class);
        verify(bytes).send(sent.capture());
        verify(objects, never()).send(any(ProducerRecord.class));
        assertThat(sent.getValue().topic()).isEqualTo(TOPIC + "-dlt");
        assertThat(sent.getValue().value()).isEqualTo(raw);
    }

    private ConcurrentKafkaListenerContainerFactory<Object, Object> factory(ConsumerRetryPolicy policy) {
        return RetryingListenerContainerFactories.create(consumerFactory(), bytes, objects, policy);
    }

    private static ConsumerAwareRecordRecoverer recoverer(ConcurrentKafkaListenerContainerFactory<Object, Object> f) {
        Object handler = ReflectionTestUtils.getField(f, "commonErrorHandler");
        Object tracker = ReflectionTestUtils.getField(handler, "failureTracker");
        return (ConsumerAwareRecordRecoverer) ReflectionTestUtils.getField(tracker, "recoverer");
    }

    private static ConsumerRecord<String, Object> record(Object value) {
        return new ConsumerRecord<>(TOPIC, 0, 7L, "mailbox-1", value);
    }

    @SuppressWarnings("unchecked")
    private static ConsumerFactory<Object, Object> consumerFactory() {
        ConsumerFactory<Object, Object> factory = mock(ConsumerFactory.class);
        when(factory.getConfigurationProperties()).thenReturn(Map.of(
                ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092"));
        return factory;
    }
}
