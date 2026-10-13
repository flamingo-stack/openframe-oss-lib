package com.openframe.debezium.recovery.gap;

import tools.jackson.databind.ObjectMapper;
import com.openframe.debezium.util.ConnectorSpecs;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.admin.Admin;
import org.apache.kafka.clients.admin.AdminClientConfig;
import org.apache.kafka.clients.admin.NewTopic;
import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.config.TopicConfig;
import org.apache.kafka.common.errors.TopicExistsException;
import org.apache.kafka.common.serialization.StringSerializer;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "openframe.debezium.recovery.gap.enabled", havingValue = "true")
public class SnapshotSignalPublisher {

    // Debezium's Kafka signal channel only reads partition 0.
    private static final int SIGNAL_PARTITIONS = 1;
    private static final String SIGNAL_RETENTION_MS = String.valueOf(Duration.ofDays(1).toMillis());
    private static final long SEND_TIMEOUT_SECONDS = 30;

    private final ObjectMapper objectMapper;

    public boolean hasSignalChannel(Map<String, Object> config) {
        String topic = ConnectorSpecs.stringOf(config, ConnectorSpecs.KEY_SIGNAL_TOPIC);
        String bootstrapServers = ConnectorSpecs.stringOf(config, ConnectorSpecs.KEY_SIGNAL_BOOTSTRAP_SERVERS);
        return !topic.isBlank() && !bootstrapServers.isBlank();
    }

    public void publishIncrementalSnapshot(Map<String, Object> config, List<SnapshotCondition> conditions) {
        String topic = ConnectorSpecs.stringOf(config, ConnectorSpecs.KEY_SIGNAL_TOPIC);
        String bootstrapServers = ConnectorSpecs.stringOf(config, ConnectorSpecs.KEY_SIGNAL_BOOTSTRAP_SERVERS);
        String connectorLogicalName = ConnectorSpecs.stringOf(config, ConnectorSpecs.KEY_TOPIC_PREFIX);
        IncrementalSnapshotSignal snapshotSignal = new IncrementalSnapshotSignal(conditions);
        String signal = snapshotSignal.toJson(objectMapper);
        ProducerRecord<String, String> signalRecord = new ProducerRecord<>(topic, connectorLogicalName, signal);
        ensureSignalTopic(bootstrapServers, topic);
        send(bootstrapServers, signalRecord);
        log.info("Incremental snapshot signal sent: topic='{}' key='{}' signal={}", topic, connectorLogicalName, signal);
    }

    private void ensureSignalTopic(String bootstrapServers, String topic) {
        Map<String, Object> adminConfig = Map.of(AdminClientConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        NewTopic signalTopic = new NewTopic(topic, Optional.of(SIGNAL_PARTITIONS), Optional.empty())
                .configs(Map.of(TopicConfig.RETENTION_MS_CONFIG, SIGNAL_RETENTION_MS));
        try (Admin admin = Admin.create(adminConfig)) {
            admin.createTopics(List.of(signalTopic)).all().get(SEND_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            log.info("Signal topic '{}' created", topic);
        } catch (ExecutionException e) {
            rethrowUnlessTopicExists(e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted while creating signal topic " + topic, e);
        } catch (TimeoutException e) {
            throw new IllegalStateException("Timed out creating signal topic " + topic, e);
        }
    }

    private static void rethrowUnlessTopicExists(ExecutionException e) {
        if (e.getCause() instanceof TopicExistsException) return;
        throw new IllegalStateException("Failed to create signal topic", e);
    }

    private static void send(String bootstrapServers, ProducerRecord<String, String> signalRecord) {
        Map<String, Object> producerConfig = Map.of(
                ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers,
                ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class,
                ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, StringSerializer.class,
                ProducerConfig.ACKS_CONFIG, "all");
        try (KafkaProducer<String, String> producer = new KafkaProducer<>(producerConfig)) {
            producer.send(signalRecord).get(SEND_TIMEOUT_SECONDS, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted while sending snapshot signal", e);
        } catch (ExecutionException | TimeoutException e) {
            throw new IllegalStateException("Failed to send snapshot signal", e);
        }
    }
}
