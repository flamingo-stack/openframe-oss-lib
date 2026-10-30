package com.openframe.kafka.producer;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.openframe.kafka.exception.TransientKafkaSendException;
import com.openframe.kafka.model.MachinePinotMessage;
import org.apache.kafka.clients.producer.MockProducer;
import org.apache.kafka.clients.producer.Producer;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.errors.TimeoutException;
import org.apache.kafka.common.serialization.StringSerializer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.ProducerFactory;
import org.springframework.kafka.support.LoggingProducerListener;

import java.util.Map;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DualWriteKafkaProducerTest {

    private static final String TOPIC = "shared.devices-topic";
    private static final String KEY = "machine-42";
    private static final String SECONDARY_CLUSTER = "kafka-tenant:9092";

    private final MachinePinotMessage row = MachinePinotMessage.builder()
            .tenantId("tenant-1")
            .machineId("machine-42")
            .status("ONLINE")
            .build();

    private final ListAppender<ILoggingEvent> logAppender = new ListAppender<>();
    private final Logger producerLogger = (Logger) LoggerFactory.getLogger(DualWriteKafkaProducer.class);
    private final Logger springListenerLogger = (Logger) LoggerFactory.getLogger(LoggingProducerListener.class);

    @Mock
    private ProducerFactory<String, Object> primaryProducerFactory;

    @Mock
    private ProducerFactory<String, Object> secondaryProducerFactory;

    @Mock
    private Producer<String, Object> unreachableSecondary;

    private DualWriteKafkaProducer producer;

    @BeforeEach
    void setUp() {
        producer = new DualWriteKafkaProducer(primaryProducerFactory, secondaryProducerFactory);
        logAppender.start();
        producerLogger.addAppender(logAppender);
        springListenerLogger.addAppender(logAppender);
    }

    @AfterEach
    void detachAppender() {
        producerLogger.detachAppender(logAppender);
        springListenerLogger.detachAppender(logAppender);
    }

    @Test
    void sendAndAwaitMessage_primaryAccepts_rowSentToBothClusters() {
        MockProducer<String, Object> primary = cluster(primaryProducerFactory, true);
        MockProducer<String, Object> secondary = cluster(secondaryProducerFactory, true);

        producer.sendAndAwaitMessage(TOPIC, row, KEY);

        assertThat(primary.history())
                .extracting(ProducerRecord::topic, ProducerRecord::key, ProducerRecord::value)
                .containsExactly(tuple(TOPIC, KEY, row));
        assertThat(secondary.history())
                .extracting(ProducerRecord::topic, ProducerRecord::key, ProducerRecord::value)
                .containsExactly(tuple(TOPIC, KEY, row));
        assertThat(logAppender.list).isEmpty();
    }

    @Test
    @Timeout(5)
    void sendAndAwaitMessage_primaryFails_throwsAndNothingSentToSecondary() {
        MockProducer<String, Object> primary = cluster(primaryProducerFactory, false);
        failOnceEnqueued(primary);

        assertThatThrownBy(() -> producer.sendAndAwaitMessage(TOPIC, row, KEY))
                .isInstanceOf(TransientKafkaSendException.class)
                .hasMessage("transient kafka error: topic=shared.devices-topic key=machine-42");
        verify(secondaryProducerFactory, never()).createProducer();
    }

    @Test
    void sendAndAwaitMessage_secondaryFailsAtOnce_logsMissAndReturns() {
        MockProducer<String, Object> primary = cluster(primaryProducerFactory, true);
        secondaryNamedInTheLog();
        when(secondaryProducerFactory.createProducer()).thenReturn(unreachableSecondary);
        when(unreachableSecondary.send(any(), any())).thenReturn(CompletableFuture.failedFuture(
                new TimeoutException("Topic shared.devices-topic not present in metadata after 1000 ms.")));

        assertThatCode(() -> producer.sendAndAwaitMessage(TOPIC, row, KEY)).doesNotThrowAnyException();

        assertThat(primary.history()).extracting(ProducerRecord::key).containsExactly(KEY);
        assertThat(logAppender.list).singleElement().satisfies(event -> {
            assertThat(event.getLevel()).isEqualTo(Level.ERROR);
            assertThat(event.getFormattedMessage()).isEqualTo(
                    "Write to secondary cluster failed: cluster=kafka-tenant:9092 topic=shared.devices-topic key=machine-42 "
                            + "error=Topic shared.devices-topic not present in metadata after 1000 ms.");
        });
    }

    @Test
    @Timeout(5)
    void sendAndAwaitMessage_secondaryFailsLater_returnsWithoutWaitingAndLogsOneErrorLineOfItsOwn() {
        cluster(primaryProducerFactory, true);
        secondaryNamedInTheLog();
        MockProducer<String, Object> secondary = cluster(secondaryProducerFactory, false);
        producer.sendAndAwaitMessage(TOPIC, row, KEY);

        secondary.errorNext(new TimeoutException("Expiring 1 record(s) for shared.devices-topic-0"));

        assertThat(logAppender.list).singleElement().satisfies(event -> {
            assertThat(event.getLoggerName()).isEqualTo(DualWriteKafkaProducer.class.getName());
            assertThat(event.getLevel()).isEqualTo(Level.ERROR);
            assertThat(event.getFormattedMessage()).isEqualTo(
                    "Write to secondary cluster failed: cluster=kafka-tenant:9092 topic=shared.devices-topic key=machine-42 "
                            + "error=Expiring 1 record(s) for shared.devices-topic-0");
        });
    }

    @Test
    void sendAsyncMessage_called_refused() {
        assertThatThrownBy(() -> producer.sendAsyncMessage(TOPIC, row, KEY))
                .isInstanceOf(UnsupportedOperationException.class)
                .hasMessage("Not supported by the dual write");
    }

    @Test
    void sendAndAwaitMessageWithHeaders_called_refused() {
        assertThatThrownBy(() -> producer.sendAndAwaitMessage(TOPIC, row, KEY, Map.of("message-type", "MACHINE")))
                .isInstanceOf(UnsupportedOperationException.class)
                .hasMessage("Not supported by the dual write");
    }

    @Test
    void close_called_resetsBothProducerFactories() {
        producer.close();

        verify(primaryProducerFactory).reset();
        verify(secondaryProducerFactory).reset();
    }

    private static void failOnceEnqueued(MockProducer<String, Object> primary) {
        Thread.ofVirtual().start(() -> {
            while (primary.history().isEmpty()) {
                Thread.onSpinWait();
            }
            primary.errorNext(new TimeoutException("Expiring 1 record(s) for shared.devices-topic-0"));
        });
    }

    private void secondaryNamedInTheLog() {
        when(secondaryProducerFactory.getConfigurationProperties())
                .thenReturn(Map.of(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, SECONDARY_CLUSTER));
    }

    private static MockProducer<String, Object> cluster(ProducerFactory<String, Object> factory, boolean autoComplete) {
        MockProducer<String, Object> cluster =
                new MockProducer<>(autoComplete, null, new StringSerializer(), (_, _) -> new byte[0]);
        when(factory.createProducer()).thenReturn(cluster);
        return cluster;
    }
}
