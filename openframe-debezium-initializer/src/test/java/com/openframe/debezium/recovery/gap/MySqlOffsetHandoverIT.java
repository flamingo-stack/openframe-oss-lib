package com.openframe.debezium.recovery.gap;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
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
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import org.springframework.test.util.ReflectionTestUtils;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

// Debezium Connect 3.3.2 on localhost:8083, its Kafka also on localhost:29092 and mysql:8.0 with GTID + ROW binlog on localhost:3307, all in one docker network.
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class MySqlOffsetHandoverIT {

    private static final String CONNECT_URL = "http://localhost:8083";
    private static final String HOST_JDBC = "jdbc:mysql://localhost:3307/?user=root&password=root";
    private static final String HOST_KAFKA = "localhost:29092";
    private static final String NETWORK_KAFKA = "openframe-test-connect-kafka:9092";
    private static final Duration WAIT = Duration.ofSeconds(90);
    private static final Pattern SAFE_DB_NAME = Pattern.compile("[a-z0-9_]+");

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final ConnectorBackfillRepository backfillRepository = mock(ConnectorBackfillRepository.class);

    private DebeziumService debeziumService;
    private String baseName;
    private String topicPrefix;
    private String database;
    private Map<String, Object> config;

    @BeforeEach
    void setUp() throws SQLException {
        String runId = UUID.randomUUID().toString().substring(0, 8);
        baseName = "it-fleet-handover-" + runId;
        topicPrefix = "it.fleet.handover." + runId;
        database = "fleet_handover_" + runId;
        GapRecoveryProperties properties = new GapRecoveryProperties();
        StaticListableBeanFactory beans = new StaticListableBeanFactory();
        ObjectProvider<ConnectorRecreator> recreatorProvider = beans.getBeanProvider(ConnectorRecreator.class);
        debeziumService = new DebeziumService(new VersionedConnectorNameStrategy(), null, properties, recreatorProvider);
        ReflectionTestUtils.setField(debeziumService, "debeziumUrl", CONNECT_URL);
        ReflectionTestUtils.setField(debeziumService, "connectTimeout", Duration.ofSeconds(5));
        ReflectionTestUtils.setField(debeziumService, "readTimeout", Duration.ofSeconds(60));
        debeziumService.init();
        SourceDialects dialects = new SourceDialects(List.of(new MySqlSourceDialect()));
        ConnectorRecreator recreator = new ConnectorRecreator(debeziumService, dialects, mock(ConnectorCheckpointRepository.class),
                backfillRepository, properties, mock(UnfilledGapAlerts.class));
        beans.addBean("connectorRecreator", recreator);
        config = connectorConfig();
        createSchema();
    }

    @AfterEach
    void tearDown() throws SQLException {
        debeziumService.deleteConnector(baseName + "_v1");
        debeziumService.deleteConnector(baseName + "_v2");
        execute("DROP DATABASE IF EXISTS " + database);
    }

    // The spec keeps snapshot.mode=initial like the Fleet connector: a recreate without the handover would snapshot the table again.
    @Test
    void createOrUpdate_configDriftOnInitialSnapshotSpec_newVersionResumesFromOldGtidWithoutSnapshot() throws SQLException {
        // setup
        insertActivity(1);
        Object[] initialSpecs = {Map.of("name", baseName, "config", config)};
        debeziumService.createOrUpdateDebeziumConnector(initialSpecs);
        awaitRunning(baseName + "_v1");
        insertActivity(2);
        awaitRecords(2);
        awaitOffsets(baseName + "_v1");
        debeziumService.stopConnector(baseName + "_v1");
        insertActivity(3);
        Map<String, Object> driftedConfig = new HashMap<>(config);
        driftedConfig.put("heartbeat.interval.ms", "5000");
        Object[] driftedSpecs = {Map.of("name", baseName, "config", driftedConfig)};

        // execution
        debeziumService.createOrUpdateDebeziumConnector(driftedSpecs);

        // verifications
        awaitRunning(baseName + "_v2");
        insertActivity(4);
        List<JsonNode> delivered = awaitRecords(4);
        assertThat(delivered)
                .filteredOn(record -> "r".equals(record.path("op").asText()))
                .extracting(record -> record.path("after").path("id").asInt())
                .containsExactly(1);
        assertThat(delivered)
                .filteredOn(record -> "c".equals(record.path("op").asText()))
                .extracting(record -> record.path("after").path("id").asInt())
                .containsOnly(2, 3, 4)
                .contains(3, 4);
        assertThat(debeziumService.listConnectors()).doesNotContain(baseName + "_v1");
        verifyNoInteractions(backfillRepository);
    }

    private Map<String, Object> connectorConfig() {
        Map<String, Object> connector = new HashMap<>();
        connector.put("connector.class", "io.debezium.connector.mysql.MySqlConnector");
        connector.put("database.hostname", "openframe-test-connect-mysql");
        connector.put("database.port", "3306");
        connector.put("database.user", "root");
        connector.put("database.password", "root");
        connector.put("database.server.id", String.valueOf(Math.abs(topicPrefix.hashCode() % 100000) + 1000));
        connector.put("database.include.list", database);
        connector.put("table.include.list", database + ".activity_past");
        connector.put("topic.prefix", topicPrefix);
        connector.put("snapshot.mode", "initial");
        connector.put("offset.flush.interval.ms", "1000");
        connector.put("schema.history.internal.kafka.topic", topicPrefix + ".schema-history");
        connector.put("schema.history.internal.kafka.bootstrap.servers", NETWORK_KAFKA);
        connector.put("key.converter", "org.apache.kafka.connect.json.JsonConverter");
        connector.put("value.converter", "org.apache.kafka.connect.json.JsonConverter");
        connector.put("value.converter.schemas.enable", "false");
        return connector;
    }

    private void createSchema() throws SQLException {
        assertThat(SAFE_DB_NAME.matcher(database).matches()).isTrue();
        execute("CREATE DATABASE " + database);
        execute("CREATE TABLE " + database + ".activity_past (id INT PRIMARY KEY, created_at TIMESTAMP(6) NOT NULL)");
    }

    private void insertActivity(int id) throws SQLException {
        execute("INSERT INTO " + database + ".activity_past (id, created_at) VALUES (" + id + ", UTC_TIMESTAMP())");
    }

    private void execute(String sql) throws SQLException {
        try (Connection connection = DriverManager.getConnection(HOST_JDBC);
             Statement statement = connection.createStatement()) {
            statement.execute(sql);
        }
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

    // Kafka Connect commits source offsets on its own flush cycle, so wait until a position is stored.
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
            consumer.subscribe(List.of(topicPrefix + "." + database + ".activity_past"));
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
