package com.openframe.debezium.recovery.gap;

import org.apache.kafka.clients.admin.Admin;
import org.apache.kafka.clients.admin.AdminClientConfig;
import org.apache.kafka.clients.admin.Config;
import org.apache.kafka.clients.admin.ConfigEntry;
import org.apache.kafka.clients.admin.NewTopic;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.common.TopicPartition;
import org.apache.kafka.common.config.ConfigResource;
import org.apache.kafka.common.config.TopicConfig;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

// Kafka on localhost:29092 (the broker of the Debezium Connect test stack).
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class SnapshotSignalPublisherIT {

    private static final String HOST_KAFKA = "localhost:29092";
    private static final Duration BACKFILL_EXPIRY = Duration.ofHours(2);
    private static final String EXPECTED_MS = String.valueOf(BACKFILL_EXPIRY.toMillis());
    private static final List<SnapshotCondition> CONDITIONS =
            List.of(new SnapshotCondition("meshcentral.events", "{\"_id\": {\"$gte\": 1}}"));

    private final ObjectMapper objectMapper = new ObjectMapper();

    private SnapshotSignalPublisher publisher;
    private Admin admin;
    private String topic;
    private String topicPrefix;

    @BeforeEach
    void setUp() {
        String runId = UUID.randomUUID().toString().substring(0, 8);
        topic = "it.signal." + runId;
        topicPrefix = "it.prefix." + runId;
        GapRecoveryProperties properties = new GapRecoveryProperties();
        properties.setBackfillExpiry(BACKFILL_EXPIRY);
        publisher = new SnapshotSignalPublisher(objectMapper, properties, new SignalKafkaClients());
        admin = Admin.create(Map.of(AdminClientConfig.BOOTSTRAP_SERVERS_CONFIG, HOST_KAFKA));
    }

    @AfterEach
    void tearDown() throws Exception {
        admin.deleteTopics(List.of(topic)).all().get();
        admin.close();
    }

    @Test
    void publishIncrementalSnapshot_topicMissing_createdWithShortRetentionAndSignalSent() throws Exception {
        // setup
        Map<String, Object> config = signalConfig();

        // execution
        publisher.publishIncrementalSnapshot(config, CONDITIONS);

        // verifications
        assertThat(topicConfig())
                .containsEntry(TopicConfig.RETENTION_MS_CONFIG, EXPECTED_MS)
                .containsEntry(TopicConfig.SEGMENT_MS_CONFIG, EXPECTED_MS);
        List<ConsumerRecord<String, String>> records = readAll();
        assertThat(records)
                .extracting(ConsumerRecord::key, ConsumerRecord::partition)
                .containsExactly(tuple(topicPrefix, 0));
        JsonNode signal = objectMapper.readTree(records.getFirst().value());
        assertThat(signal.path("type").asString()).isEqualTo("execute-snapshot");
    }

    @Test
    void publishIncrementalSnapshot_topicAutoCreatedWithDefaults_retentionShortened() throws Exception {
        // setup
        NewTopic autoCreated = new NewTopic(topic, Optional.of(1), Optional.empty());
        admin.createTopics(List.of(autoCreated)).all().get();
        Map<String, Object> config = signalConfig();

        // execution
        publisher.publishIncrementalSnapshot(config, CONDITIONS);

        // verifications
        assertThat(topicConfig())
                .containsEntry(TopicConfig.RETENTION_MS_CONFIG, EXPECTED_MS)
                .containsEntry(TopicConfig.SEGMENT_MS_CONFIG, EXPECTED_MS);
    }

    private Map<String, Object> signalConfig() {
        return Map.of(
                "signal.enabled.channels", "kafka",
                "signal.kafka.topic", topic,
                "signal.kafka.bootstrap.servers", HOST_KAFKA,
                "topic.prefix", topicPrefix);
    }

    private Map<String, String> topicConfig() throws Exception {
        ConfigResource resource = new ConfigResource(ConfigResource.Type.TOPIC, topic);
        Config config = admin.describeConfigs(List.of(resource)).all().get().get(resource);
        return config.entries().stream()
                .collect(Collectors.toMap(ConfigEntry::name, entry -> String.valueOf(entry.value())));
    }

    private List<ConsumerRecord<String, String>> readAll() {
        Map<String, Object> consumerConfig = Map.of(
                ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, HOST_KAFKA,
                ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class,
                ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class,
                ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
        List<ConsumerRecord<String, String>> records = new ArrayList<>();
        try (KafkaConsumer<String, String> consumer = new KafkaConsumer<>(consumerConfig)) {
            TopicPartition partition = new TopicPartition(topic, 0);
            consumer.assign(List.of(partition));
            consumer.seekToBeginning(List.of(partition));
            consumer.poll(Duration.ofSeconds(10)).forEach(records::add);
        }
        return records;
    }
}
