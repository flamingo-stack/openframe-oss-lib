package com.openframe.debezium.recovery.gap;

import org.apache.kafka.clients.admin.Admin;
import org.apache.kafka.clients.admin.AlterConfigOp;
import org.apache.kafka.clients.admin.AlterConfigsResult;
import org.apache.kafka.clients.admin.CreateTopicsResult;
import org.apache.kafka.clients.admin.NewTopic;
import org.apache.kafka.clients.producer.Producer;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.clients.producer.RecordMetadata;
import org.apache.kafka.common.KafkaFuture;
import org.apache.kafka.common.config.ConfigResource;
import org.apache.kafka.common.errors.TopicExistsException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.ObjectMapper;

import java.time.Duration;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SnapshotSignalPublisherSendTest {

    private static final String BOOTSTRAP = "kafka:9092";
    private static final String TOPIC = "shared.meshcentral.debezium-signal";
    private static final String PREFIX = "shared.meshcentral";
    private static final String TWO_HOURS_MS = "7200000";
    private static final Map<String, Object> CONFIG = Map.of(
            "signal.enabled.channels", "kafka",
            "signal.kafka.topic", TOPIC,
            "signal.kafka.bootstrap.servers", BOOTSTRAP,
            "topic.prefix", PREFIX);
    private static final List<SnapshotCondition> CONDITIONS =
            List.of(new SnapshotCondition("meshcentral.events", "{\"_id\": {\"$gte\": 1}}"));

    @Mock private SignalKafkaClients kafkaClients;
    @Mock private Admin admin;
    @Mock private Producer<String, String> producer;
    @Mock private CreateTopicsResult createTopicsResult;
    @Mock private AlterConfigsResult alterConfigsResult;
    @Mock private KafkaFuture<Void> creation;
    @Mock private KafkaFuture<Void> alteration;

    @Captor private ArgumentCaptor<Collection<NewTopic>> topicsCaptor;
    @Captor private ArgumentCaptor<Map<ConfigResource, Collection<AlterConfigOp>>> alterCaptor;
    @Captor private ArgumentCaptor<ProducerRecord<String, String>> recordCaptor;

    private SnapshotSignalPublisher publisher;

    @BeforeEach
    void setUp() {
        GapRecoveryProperties properties = new GapRecoveryProperties();
        properties.setBackfillExpiry(Duration.ofHours(2));
        publisher = new SnapshotSignalPublisher(new ObjectMapper(), properties, kafkaClients);
    }

    @Test
    void publishIncrementalSnapshot_topicMissing_createdWithShortRetentionAndSignalSent() throws Exception {
        // setup
        stubAdmin();
        stubAlter();
        stubProducer(CompletableFuture.completedFuture(null));

        // execution
        publisher.publishIncrementalSnapshot(CONFIG, CONDITIONS);

        // verifications
        verify(admin).createTopics(topicsCaptor.capture());
        assertThat(topicsCaptor.getValue())
                .extracting(NewTopic::name, NewTopic::numPartitions)
                .containsExactly(tuple(TOPIC, 1));
        assertThat(topicsCaptor.getValue().iterator().next().configs())
                .containsEntry("retention.ms", TWO_HOURS_MS)
                .containsEntry("segment.ms", TWO_HOURS_MS);
        verify(producer).send(recordCaptor.capture());
        assertThat(recordCaptor.getValue())
                .extracting(ProducerRecord::topic, ProducerRecord::key)
                .containsExactly(TOPIC, PREFIX);
        assertThat(recordCaptor.getValue().value()).contains("\"type\":\"execute-snapshot\"");
        verify(admin).close();
        verify(producer).close();
    }

    @Test
    void publishIncrementalSnapshot_topicExists_retentionEnforcedOnIt() throws Exception {
        // setup
        stubAdmin();
        when(creation.get(30, TimeUnit.SECONDS)).thenThrow(new ExecutionException(new TopicExistsException(TOPIC)));
        stubAlter();
        stubProducer(CompletableFuture.completedFuture(null));

        // execution
        publisher.publishIncrementalSnapshot(CONFIG, CONDITIONS);

        // verifications
        verify(admin).incrementalAlterConfigs(alterCaptor.capture());
        ConfigResource topicResource = new ConfigResource(ConfigResource.Type.TOPIC, TOPIC);
        assertThat(alterCaptor.getValue().get(topicResource))
                .extracting(op -> op.configEntry().name(), op -> op.configEntry().value(), AlterConfigOp::opType)
                .containsExactlyInAnyOrder(
                        tuple("retention.ms", TWO_HOURS_MS, AlterConfigOp.OpType.SET),
                        tuple("segment.ms", TWO_HOURS_MS, AlterConfigOp.OpType.SET));
        verify(producer).send(recordCaptor.capture());
    }

    @Test
    void publishIncrementalSnapshot_topicCreationFails_signalSentWithoutReconfiguring() throws Exception {
        // setup
        stubAdmin();
        when(creation.get(30, TimeUnit.SECONDS)).thenThrow(new ExecutionException(new IllegalStateException("acl")));
        stubProducer(CompletableFuture.completedFuture(null));

        // execution
        publisher.publishIncrementalSnapshot(CONFIG, CONDITIONS);

        // verifications
        verify(admin, never()).incrementalAlterConfigs(any());
        verify(producer).send(recordCaptor.capture());
        verify(admin).close();
    }

    @Test
    void publishIncrementalSnapshot_retentionRefused_signalStillSent() throws Exception {
        // setup
        stubAdmin();
        when(admin.incrementalAlterConfigs(any())).thenReturn(alterConfigsResult);
        when(alterConfigsResult.all()).thenReturn(alteration);
        when(alteration.get(30, TimeUnit.SECONDS)).thenThrow(new ExecutionException(new IllegalStateException("denied")));
        stubProducer(CompletableFuture.completedFuture(null));

        // execution
        publisher.publishIncrementalSnapshot(CONFIG, CONDITIONS);

        // verifications
        verify(producer).send(recordCaptor.capture());
        assertThat(recordCaptor.getValue().topic()).isEqualTo(TOPIC);
    }

    @Test
    void publishIncrementalSnapshot_sendFails_errorRaised() {
        // setup
        stubAdmin();
        stubAlter();
        Future<RecordMetadata> failed = CompletableFuture.failedFuture(new IllegalStateException("broker down"));
        stubProducer(failed);

        // execution
        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> publisher.publishIncrementalSnapshot(CONFIG, CONDITIONS));

        // verifications
        assertThat(ex.getMessage()).isEqualTo("Failed to send snapshot signal to " + TOPIC);
        verify(producer).close();
    }

    @Test
    void publishIncrementalSnapshot_interruptedWhileSending_interruptFlagRestored() {
        // setup
        stubAdmin();
        stubAlter();
        Future<RecordMetadata> interrupted = new InterruptedFuture();
        stubProducer(interrupted);

        // execution
        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> publisher.publishIncrementalSnapshot(CONFIG, CONDITIONS));
        boolean interruptFlag = Thread.interrupted();

        // verifications
        assertThat(ex.getMessage()).isEqualTo("Interrupted while trying to send snapshot signal to " + TOPIC);
        assertThat(interruptFlag).isTrue();
    }

    private void stubAdmin() {
        when(kafkaClients.admin(BOOTSTRAP)).thenReturn(admin);
        when(admin.createTopics(any())).thenReturn(createTopicsResult);
        when(createTopicsResult.all()).thenReturn(creation);
    }

    private void stubAlter() {
        when(admin.incrementalAlterConfigs(any())).thenReturn(alterConfigsResult);
        when(alterConfigsResult.all()).thenReturn(alteration);
    }

    private void stubProducer(Future<RecordMetadata> result) {
        when(kafkaClients.producer(BOOTSTRAP)).thenReturn(producer);
        when(producer.send(any())).thenReturn(result);
    }

    private static class InterruptedFuture extends CompletableFuture<RecordMetadata> {

        @Override
        public RecordMetadata get(long timeout, TimeUnit unit) throws InterruptedException {
            throw new InterruptedException("test");
        }
    }
}
