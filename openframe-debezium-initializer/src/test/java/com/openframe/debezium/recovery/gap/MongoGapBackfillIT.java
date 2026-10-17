package com.openframe.debezium.recovery.gap;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoCollection;
import com.openframe.debezium.dto.ConnectorStatus;
import com.openframe.debezium.naming.VersionedConnectorNameStrategy;
import com.openframe.debezium.service.DebeziumService;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

// Debezium Connect 3.3.2 on localhost:8083, its Kafka also on localhost:29092 and a mongo:7 rs0 on localhost:27018, all in one docker network.
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class MongoGapBackfillIT {

    private static final String CONNECT_URL = "http://localhost:8083";
    private static final String HOST_MONGO = "mongodb://localhost:27018/?directConnection=true";
    private static final String HOST_KAFKA = "localhost:29092";
    private static final String NETWORK_MONGO = "mongodb://openframe-test-connect-mongo:27017/?replicaSet=rs0";
    private static final String NETWORK_KAFKA = "openframe-test-connect-kafka:9092";
    private static final Duration WAIT = Duration.ofSeconds(90);

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final MongoSourceDialect dialect = new MongoSourceDialect();

    private DebeziumService debeziumService;
    private MongoClient mongoClient;
    private String connectorName;
    private String topicPrefix;
    private Map<String, Object> config;
    private Instant now;

    @BeforeEach
    void setUp() {
        String runId = UUID.randomUUID().toString().substring(0, 8);
        connectorName = "it-mesh-" + runId + "_v1";
        topicPrefix = "it.mesh." + runId;
        now = Instant.now();
        ObjectProvider<ConnectorRecreator> noRecreator = new StaticListableBeanFactory().getBeanProvider(ConnectorRecreator.class);
        debeziumService = new DebeziumService(new VersionedConnectorNameStrategy(), null, new GapRecoveryProperties(), noRecreator);
        ReflectionTestUtils.setField(debeziumService, "debeziumUrl", CONNECT_URL);
        ReflectionTestUtils.setField(debeziumService, "connectTimeout", Duration.ofSeconds(5));
        ReflectionTestUtils.setField(debeziumService, "readTimeout", Duration.ofSeconds(60));
        debeziumService.init();
        mongoClient = MongoClients.create(HOST_MONGO);
        config = connectorConfig();
    }

    @AfterEach
    void tearDown() {
        debeziumService.deleteConnector(connectorName);
        mongoClient.close();
    }

    @Test
    void incrementalSnapshot_idWindowSignalledOverKafka_onlyGapEventsReplayed() {
        // setup
        MongoCollection<Document> events = events();
        events.drop();
        ObjectId beforeGap = idAt(now.minus(Duration.ofHours(2)));
        ObjectId inGapFirst = idAt(now.minus(Duration.ofMinutes(20)));
        ObjectId inGapSecond = idAt(now.minus(Duration.ofMinutes(10)));
        events.insertMany(List.of(event(beforeGap), event(inGapFirst), event(inGapSecond)));
        debeziumService.createConnector(connectorName, config);
        awaitRunning();
        List<SnapshotCondition> conditions = dialect.gapConditions(config, Map.of(), now.minus(Duration.ofMinutes(30)));
        Map<String, Object> hostSideConfig = hostSideConfig();
        GapRecoveryProperties signalProperties = new GapRecoveryProperties();
        signalProperties.setBackfillExpiry(Duration.ofHours(2));
        SnapshotSignalPublisher publisher = new SnapshotSignalPublisher(objectMapper, signalProperties);

        // execution
        publisher.publishIncrementalSnapshot(hostSideConfig, conditions);

        // verifications
        List<JsonNode> replayed = awaitRecords(2);
        assertThat(replayed)
                .extracting(record -> record.path("op").asText(), this::eventId)
                .containsExactlyInAnyOrder(tuple("r", inGapFirst.toHexString()), tuple("r", inGapSecond.toHexString()));
    }

    private Map<String, Object> connectorConfig() {
        Map<String, Object> connector = new HashMap<>();
        connector.put("connector.class", "io.debezium.connector.mongodb.MongoDbConnector");
        connector.put("mongodb.connection.string", NETWORK_MONGO);
        connector.put("topic.prefix", topicPrefix);
        connector.put("collection.include.list", "meshcentral.events");
        connector.put("snapshot.mode", "no_data");
        connector.put("signal.enabled.channels", "source,kafka");
        connector.put("signal.data.collection", "meshcentral.debezium_signal");
        connector.put("signal.kafka.topic", topicPrefix + ".debezium-signal");
        connector.put("signal.kafka.groupId", topicPrefix + ".debezium-signal");
        connector.put("signal.kafka.bootstrap.servers", NETWORK_KAFKA);
        connector.put("key.converter", "org.apache.kafka.connect.json.JsonConverter");
        connector.put("value.converter", "org.apache.kafka.connect.json.JsonConverter");
        connector.put("value.converter.schemas.enable", "false");
        return connector;
    }

    private Map<String, Object> hostSideConfig() {
        Map<String, Object> hostSide = new HashMap<>(config);
        hostSide.put("signal.kafka.bootstrap.servers", HOST_KAFKA);
        return hostSide;
    }

    private MongoCollection<Document> events() {
        return mongoClient.getDatabase("meshcentral").getCollection("events");
    }

    private static ObjectId idAt(Instant instant) {
        return new ObjectId(Date.from(instant));
    }

    private static Document event(ObjectId id) {
        return new Document("_id", id).append("etype", "node").append("action", "it");
    }

    private String eventId(JsonNode record) {
        try {
            JsonNode after = objectMapper.readTree(record.path("after").asText());
            return after.path("_id").path("$oid").asText();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private void awaitRunning() {
        Instant deadline = Instant.now().plus(WAIT);
        while (Instant.now().isBefore(deadline)) {
            ConnectorStatus status = debeziumService.getConnectorStatus(connectorName);
            if (status != null && status.isRunning()) return;
            sleep();
        }
        throw new IllegalStateException("Connector never reached RUNNING: " + connectorName);
    }

    private List<JsonNode> awaitRecords(int expected) {
        List<JsonNode> received = new ArrayList<>();
        Map<String, Object> consumerConfig = Map.of(
                ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, HOST_KAFKA,
                ConsumerConfig.GROUP_ID_CONFIG, "it-" + topicPrefix,
                ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest",
                ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class,
                ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        try (KafkaConsumer<String, String> consumer = new KafkaConsumer<>(consumerConfig)) {
            consumer.subscribe(List.of(topicPrefix + ".meshcentral.events"));
            Instant deadline = Instant.now().plus(WAIT);
            while (received.size() < expected && Instant.now().isBefore(deadline)) {
                for (ConsumerRecord<String, String> record : consumer.poll(Duration.ofSeconds(2))) {
                    received.add(readTree(record.value()));
                }
            }
            consumer.poll(Duration.ofSeconds(5)).forEach(record -> received.add(readTree(record.value())));
        }
        return received;
    }

    private JsonNode readTree(String value) {
        try {
            return objectMapper.readTree(value);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static void sleep() {
        try {
            Thread.sleep(1000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
