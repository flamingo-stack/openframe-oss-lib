package com.openframe.debezium.recovery.gap;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoCollection;
import com.openframe.data.repository.connector.ConnectorBackfillRepository;
import com.openframe.data.repository.connector.ConnectorCheckpointRepository;
import com.openframe.debezium.dto.ConnectorOffsets;
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
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

// Debezium Connect 3.3.2 on localhost:8083, its Kafka also on localhost:29092 and a mongo:7 rs0 on localhost:27018, all in one docker network.
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class MongoOffsetHandoverIT {

    private static final String CONNECT_URL = "http://localhost:8083";
    private static final String HOST_MONGO = "mongodb://localhost:27018/?directConnection=true";
    private static final String HOST_KAFKA = "localhost:29092";
    private static final String NETWORK_MONGO = "mongodb://openframe-test-connect-mongo:27017/?replicaSet=rs0";
    private static final Duration WAIT = Duration.ofSeconds(90);

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final ConnectorBackfillRepository backfillRepository = mock(ConnectorBackfillRepository.class);

    private DebeziumService debeziumService;
    private ConnectorRecreator recreator;
    private MongoClient mongoClient;
    private String baseName;
    private String topicPrefix;
    private String collection;
    private Map<String, Object> config;

    @BeforeEach
    void setUp() {
        String runId = UUID.randomUUID().toString().substring(0, 8);
        baseName = "it-handover-" + runId;
        topicPrefix = "it.handover." + runId;
        collection = "events_" + runId;
        GapRecoveryProperties properties = new GapRecoveryProperties();
        debeziumService = new DebeziumService(new VersionedConnectorNameStrategy(), null, properties);
        ReflectionTestUtils.setField(debeziumService, "debeziumUrl", CONNECT_URL);
        ReflectionTestUtils.setField(debeziumService, "connectTimeout", Duration.ofSeconds(5));
        ReflectionTestUtils.setField(debeziumService, "readTimeout", Duration.ofSeconds(60));
        debeziumService.init();
        SourceDialects dialects = new SourceDialects(List.of(new MongoSourceDialect()));
        recreator = new ConnectorRecreator(debeziumService, dialects, mock(ConnectorCheckpointRepository.class),
                backfillRepository, properties);
        mongoClient = MongoClients.create(HOST_MONGO);
        config = connectorConfig();
    }

    @AfterEach
    void tearDown() {
        debeziumService.deleteConnector(baseName + "_v1");
        debeziumService.deleteConnector(baseName + "_v2");
        mongoClient.close();
    }

    @Test
    void recreate_offsetsOfDeletedVersionHandedOver_eventWrittenDuringOutageStreamedWithoutSnapshot() {
        // setup
        MongoCollection<Document> events = mongoClient.getDatabase("meshcentral").getCollection(collection);
        ObjectId beforeOutage = new ObjectId();
        ObjectId duringOutage = new ObjectId();
        ObjectId afterRecreate = new ObjectId();
        debeziumService.createConnector(baseName + "_v1", config);
        awaitRunning(baseName + "_v1");
        events.insertOne(new Document("_id", beforeOutage));
        awaitRecords(1);
        ConnectorOffsets lastKnown = awaitOffsets(baseName + "_v1");
        debeziumService.deleteConnector(baseName + "_v1");
        events.insertOne(new Document("_id", duringOutage));
        RecreationRequest request = RecreationRequest.builder()
                .baseName(baseName)
                .newName(baseName + "_v2")
                .spec(Map.of("name", baseName, "config", config))
                .lastKnownOffsets(lastKnown)
                .historyLost(false)
                .build();

        // execution
        recreator.recreate(request);

        // verifications
        awaitRunning(baseName + "_v2");
        events.insertOne(new Document("_id", afterRecreate));
        List<JsonNode> delivered = awaitRecords(3);
        assertThat(delivered)
                .extracting(record -> record.path("op").asText())
                .containsOnly("c");
        assertThat(delivered)
                .extracting(this::eventId)
                .containsOnly(beforeOutage.toHexString(), duringOutage.toHexString(), afterRecreate.toHexString())
                .contains(duringOutage.toHexString());
        verifyNoInteractions(backfillRepository);
    }

    private Map<String, Object> connectorConfig() {
        Map<String, Object> connector = new HashMap<>();
        connector.put("connector.class", "io.debezium.connector.mongodb.MongoDbConnector");
        connector.put("mongodb.connection.string", NETWORK_MONGO);
        connector.put("topic.prefix", topicPrefix);
        connector.put("collection.include.list", "meshcentral." + collection);
        connector.put("snapshot.mode", "no_data");
        connector.put("offset.flush.interval.ms", "1000");
        connector.put("key.converter", "org.apache.kafka.connect.json.JsonConverter");
        connector.put("value.converter", "org.apache.kafka.connect.json.JsonConverter");
        connector.put("value.converter.schemas.enable", "false");
        return connector;
    }

    // Delivery is at-least-once: the deleted version may still stream a little before its task stops.
    private String eventId(JsonNode record) {
        JsonNode after = readTree(record.path("after").asText());
        return after.path("_id").path("$oid").asText();
    }

    private void awaitRunning(String connectorName) {
        Instant deadline = Instant.now().plus(WAIT);
        while (Instant.now().isBefore(deadline)) {
            ConnectorStatus status = debeziumService.getConnectorStatus(connectorName);
            if (status != null && status.isRunning()) return;
            sleep();
        }
        throw new IllegalStateException("Connector never reached RUNNING: " + connectorName);
    }

    // Kafka Connect commits source offsets on its own flush cycle, so wait until the first event's position is stored.
    private ConnectorOffsets awaitOffsets(String connectorName) {
        Instant deadline = Instant.now().plus(WAIT);
        while (Instant.now().isBefore(deadline)) {
            ConnectorOffsets offsets = debeziumService.getConnectorOffsets(connectorName);
            if (!offsets.isEmpty()) return offsets;
            sleep();
        }
        throw new IllegalStateException("No committed offsets for " + connectorName);
    }

    private List<JsonNode> awaitRecords(int expected) {
        List<JsonNode> received = new ArrayList<>();
        Map<String, Object> consumerConfig = Map.of(
                ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, HOST_KAFKA,
                ConsumerConfig.GROUP_ID_CONFIG, "it-" + UUID.randomUUID(),
                ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest",
                ConsumerConfig.METADATA_MAX_AGE_CONFIG, 1000,
                ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class,
                ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        try (KafkaConsumer<String, String> consumer = new KafkaConsumer<>(consumerConfig)) {
            consumer.subscribe(List.of(topicPrefix + ".meshcentral." + collection));
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
