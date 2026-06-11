package com.openframe.kafka.producer;

import com.openframe.kafka.enumeration.KafkaHeader;
import com.openframe.kafka.model.KafkaMessage;
import com.openframe.kafka.model.debezium.CommonDebeziumMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.kafka.support.SendResult;
import org.springframework.messaging.Message;

import java.util.Map;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Verifies the producer header path that the RMM command-result flow relies on:
 * {@code sendAndAwaitMessage(topic, msg, key, headers)} must put the extra headers
 * (e.g. {@code message-type}) onto the outgoing Spring {@link Message}, which the
 * KafkaTemplate then maps to Kafka record headers.
 *
 * <p>Guards the headers contract — a regression that drops headers (as the old
 * self-recursive {@code MessageProducer} default would have) is caught here.
 */
@ExtendWith(MockitoExtension.class)
class OssTenantKafkaProducerTest {

    private static final String TOPIC = "logs.events";
    private static final String KEY = "machine-42";

    @Mock
    private KafkaTemplate<String, Object> kafkaTemplate;

    private OssTenantKafkaProducer producer;

    @BeforeEach
    void setUp() {
        producer = new OssTenantKafkaProducer(kafkaTemplate);
    }

    @Test
    @DisplayName("sendAndAwaitMessage(..., headers): message-type (+ topic/key) are set on the outgoing Message")
    void headersAreSetOnOutgoingMessage() {
        CompletableFuture<SendResult<String, Object>> done = CompletableFuture.completedFuture(null);
        when(kafkaTemplate.send(any(Message.class))).thenReturn(done);

        KafkaMessage payload = new CommonDebeziumMessage();
        producer.sendAndAwaitMessage(TOPIC, payload, KEY,
                Map.of(KafkaHeader.MESSAGE_TYPE_HEADER, "RMM"));

        ArgumentCaptor<Message<?>> captor = ArgumentCaptor.forClass(Message.class);
        verify(kafkaTemplate).send(captor.capture());
        Message<?> sent = captor.getValue();

        assertThat(sent.getHeaders().get(KafkaHeader.MESSAGE_TYPE_HEADER)).isEqualTo("RMM");
        assertThat(sent.getHeaders().get(KafkaHeaders.TOPIC)).isEqualTo(TOPIC);
        assertThat(sent.getHeaders().get(KafkaHeaders.KEY)).isEqualTo(KEY);
        assertThat(sent.getPayload()).isSameAs(payload);
    }

    @Test
    @DisplayName("sendAndAwaitMessage(..., headers): a null headers map does not blow up")
    void nullHeadersAreTolerated() {
        CompletableFuture<SendResult<String, Object>> done = CompletableFuture.completedFuture(null);
        when(kafkaTemplate.send(any(Message.class))).thenReturn(done);

        producer.sendAndAwaitMessage(TOPIC, new CommonDebeziumMessage(), KEY, null);

        ArgumentCaptor<Message<?>> captor = ArgumentCaptor.forClass(Message.class);
        verify(kafkaTemplate).send(captor.capture());
        assertThat(captor.getValue().getHeaders().get(KafkaHeader.MESSAGE_TYPE_HEADER)).isNull();
        assertThat(captor.getValue().getHeaders().get(KafkaHeaders.TOPIC)).isEqualTo(TOPIC);
    }

    @Test
    @DisplayName("sendAndAwaitMessage(...) without headers uses the plain topic/key send overload")
    void noHeadersVariantUsesTopicKeyOverload() {
        CompletableFuture<SendResult<String, Object>> done = CompletableFuture.completedFuture(null);
        when(kafkaTemplate.send(anyString(), anyString(), any())).thenReturn(done);

        KafkaMessage payload = new CommonDebeziumMessage();
        producer.sendAndAwaitMessage(TOPIC, payload, KEY);

        verify(kafkaTemplate).send(TOPIC, KEY, payload);
    }
}
