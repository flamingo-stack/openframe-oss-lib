package com.openframe.debezium.recovery.gap;

import com.openframe.debezium.util.ConnectorSpecs;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.admin.Admin;
import org.apache.kafka.clients.admin.AlterConfigOp;
import org.apache.kafka.clients.admin.ConfigEntry;
import org.apache.kafka.clients.admin.NewTopic;
import org.apache.kafka.clients.producer.Producer;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.clients.producer.RecordMetadata;
import org.apache.kafka.common.KafkaFuture;
import org.apache.kafka.common.config.ConfigResource;
import org.apache.kafka.common.config.TopicConfig;
import org.apache.kafka.common.errors.TopicExistsException;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "openframe.debezium.recovery.gap.enabled", havingValue = "true")
public class SnapshotSignalPublisher {

    private static final String KAFKA_CHANNEL = "kafka";
    // Debezium's Kafka signal channel only reads partition 0.
    private static final int SIGNAL_PARTITIONS = 1;
    private static final long SEND_TIMEOUT_SECONDS = 30;

    private final ObjectMapper objectMapper;
    private final GapRecoveryProperties properties;
    private final SignalKafkaClients kafkaClients;

    public boolean hasSignalChannel(Map<String, Object> config) {
        List<String> channels = ConnectorSpecs.listOf(config, ConnectorSpecs.KEY_SIGNAL_CHANNELS);
        String topic = ConnectorSpecs.stringOf(config, ConnectorSpecs.KEY_SIGNAL_TOPIC);
        String bootstrapServers = ConnectorSpecs.stringOf(config, ConnectorSpecs.KEY_SIGNAL_BOOTSTRAP_SERVERS);
        return channels.contains(KAFKA_CHANNEL) && !topic.isBlank() && !bootstrapServers.isBlank();
    }

    public void publishIncrementalSnapshot(Map<String, Object> config, List<SnapshotCondition> conditions) {
        String topic = ConnectorSpecs.stringOf(config, ConnectorSpecs.KEY_SIGNAL_TOPIC);
        String bootstrapServers = ConnectorSpecs.stringOf(config, ConnectorSpecs.KEY_SIGNAL_BOOTSTRAP_SERVERS);
        String connectorLogicalName = ConnectorSpecs.stringOf(config, ConnectorSpecs.KEY_TOPIC_PREFIX);
        IncrementalSnapshotSignal snapshotSignal = new IncrementalSnapshotSignal(conditions);
        String signal = snapshotSignal.toJson(objectMapper);
        ProducerRecord<String, String> signalRecord = new ProducerRecord<>(topic, connectorLogicalName, signal);
        prepareSignalTopic(bootstrapServers, topic);
        send(bootstrapServers, signalRecord);
        log.info("Incremental snapshot signal sent: topic='{}' key='{}' signal={}", topic, connectorLogicalName, signal);
    }

    // Best effort: the short retention only guards against replays, so a broker refusing it must not block the backfill.
    private void prepareSignalTopic(String bootstrapServers, String topic) {
        try {
            ensureSignalTopic(bootstrapServers, topic);
        } catch (RuntimeException e) {
            log.warn("Could not prepare signal topic '{}', sending the signal anyway", topic, e);
        }
    }

    // A version started without offsets reads the signal topic from the beginning, so a short retention keeps
    // already-executed backfills from being replayed. Segments must roll as often, or retention never applies.
    private void ensureSignalTopic(String bootstrapServers, String topic) {
        String retentionMs = String.valueOf(properties.getBackfillExpiry().toMillis());
        Map<String, String> topicConfig = Map.of(
                TopicConfig.RETENTION_MS_CONFIG, retentionMs,
                TopicConfig.SEGMENT_MS_CONFIG, retentionMs);
        try (Admin admin = kafkaClients.admin(bootstrapServers)) {
            createTopic(admin, topic, topicConfig);
            enforceTopicConfig(admin, topic, topicConfig);
        }
    }

    private static void createTopic(Admin admin, String topic, Map<String, String> topicConfig) {
        NewTopic signalTopic = new NewTopic(topic, Optional.of(SIGNAL_PARTITIONS), Optional.empty())
                .configs(topicConfig);
        KafkaFuture<Void> creation = admin.createTopics(List.of(signalTopic)).all();
        try {
            await(creation, "create signal topic " + topic);
            log.info("Signal topic '{}' created", topic);
        } catch (IllegalStateException e) {
            rethrowUnlessTopicExists(e);
        }
    }

    // The topic may already exist with broker defaults (auto-created by the connector's signal consumer).
    private static void enforceTopicConfig(Admin admin, String topic, Map<String, String> topicConfig) {
        ConfigResource resource = new ConfigResource(ConfigResource.Type.TOPIC, topic);
        List<AlterConfigOp> operations = setOperations(topicConfig);
        Map<ConfigResource, Collection<AlterConfigOp>> alteration = Map.of(resource, operations);
        KafkaFuture<Void> alter = admin.incrementalAlterConfigs(alteration).all();
        await(alter, "configure signal topic " + topic);
    }

    private static List<AlterConfigOp> setOperations(Map<String, String> topicConfig) {
        List<AlterConfigOp> operations = new ArrayList<>();
        topicConfig.forEach((key, value) -> {
            ConfigEntry entry = new ConfigEntry(key, value);
            operations.add(new AlterConfigOp(entry, AlterConfigOp.OpType.SET));
        });
        return operations;
    }

    private static void rethrowUnlessTopicExists(IllegalStateException e) {
        if (e.getCause() instanceof ExecutionException cause && cause.getCause() instanceof TopicExistsException) return;
        throw e;
    }

    private void send(String bootstrapServers, ProducerRecord<String, String> signalRecord) {
        try (Producer<String, String> producer = kafkaClients.producer(bootstrapServers)) {
            Future<RecordMetadata> sent = producer.send(signalRecord);
            await(sent, "send snapshot signal to " + signalRecord.topic());
        }
    }

    private static <T> void await(Future<T> future, String action) {
        try {
            future.get(SEND_TIMEOUT_SECONDS, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted while trying to " + action, e);
        } catch (ExecutionException | TimeoutException e) {
            throw new IllegalStateException("Failed to " + action, e);
        }
    }
}
