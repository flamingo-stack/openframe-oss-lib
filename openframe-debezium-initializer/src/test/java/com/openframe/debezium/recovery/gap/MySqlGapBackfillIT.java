package com.openframe.debezium.recovery.gap;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
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
import static org.assertj.core.api.Assertions.tuple;

// Debezium Connect 3.3.2 on localhost:8083, its Kafka also on localhost:29092 and mysql:8.0 with GTID + ROW binlog on localhost:3307, all in one docker network.
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class MySqlGapBackfillIT {

    private static final String CONNECT_URL = "http://localhost:8083";
    private static final String HOST_JDBC = "jdbc:mysql://localhost:3307/?user=root&password=root";
    private static final String HOST_KAFKA = "localhost:29092";
    private static final String NETWORK_KAFKA = "openframe-test-connect-kafka:9092";
    private static final Duration WAIT = Duration.ofSeconds(90);
    private static final Pattern SAFE_DB_NAME = Pattern.compile("[a-z0-9_]+");

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final MySqlSourceDialect dialect = new MySqlSourceDialect();

    private DebeziumService debeziumService;
    private String connectorName;
    private String topicPrefix;
    private String database;
    private Map<String, Object> config;

    @BeforeEach
    void setUp() throws SQLException {
        String runId = UUID.randomUUID().toString().substring(0, 8);
        connectorName = "it-fleet-" + runId + "_v1";
        topicPrefix = "it.fleet." + runId;
        database = "fleet_" + runId;
        ObjectProvider<ConnectorRecreator> noRecreator = new StaticListableBeanFactory().getBeanProvider(ConnectorRecreator.class);
        debeziumService = new DebeziumService(new VersionedConnectorNameStrategy(), null, new GapRecoveryProperties(), noRecreator);
        ReflectionTestUtils.setField(debeziumService, "debeziumUrl", CONNECT_URL);
        ReflectionTestUtils.setField(debeziumService, "connectTimeout", Duration.ofSeconds(5));
        ReflectionTestUtils.setField(debeziumService, "readTimeout", Duration.ofSeconds(60));
        debeziumService.init();
        config = connectorConfig();
        createSchema();
    }

    @AfterEach
    void tearDown() throws SQLException {
        debeziumService.deleteConnector(connectorName);
        execute("DROP DATABASE IF EXISTS " + database);
    }

    @Test
    void readOnlyIncrementalSnapshot_filteredAndUnfilteredTables_gapRowsAndWholeSmallTableReplayed() throws SQLException {
        // setup
        execute("INSERT INTO " + database + ".activity_past (id, created_at) VALUES "
                + "(1, UTC_TIMESTAMP() - INTERVAL 2 HOUR), (2, UTC_TIMESTAMP() - INTERVAL 20 MINUTE), (3, UTC_TIMESTAMP() - INTERVAL 10 MINUTE)");
        execute("INSERT INTO " + database + ".teams (id, name) VALUES (10, 'old team'), (11, 'other team')");
        debeziumService.createConnector(connectorName, config);
        awaitRunning();
        Map<String, String> backfill = Map.of(database + ".activity_past", "created_at >= {from}");
        Instant gapFrom = Instant.now().minus(Duration.ofMinutes(30));
        List<SnapshotCondition> conditions = dialect.gapConditions(config, backfill, gapFrom);
        Map<String, Object> hostSideConfig = hostSideConfig();
        GapRecoveryProperties signalProperties = new GapRecoveryProperties();
        signalProperties.setBackfillExpiry(Duration.ofHours(2));
        SnapshotSignalPublisher publisher = new SnapshotSignalPublisher(objectMapper, signalProperties, new SignalKafkaClients());

        // execution
        publisher.publishIncrementalSnapshot(hostSideConfig, conditions);

        // verifications
        List<JsonNode> replayed = awaitRecords(4);
        assertThat(replayed)
                .extracting(record -> record.path("source").path("table").asText(), record -> record.path("after").path("id").asInt())
                .containsExactlyInAnyOrder(
                        tuple("activity_past", 2), tuple("activity_past", 3),
                        tuple("teams", 10), tuple("teams", 11));
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
        connector.put("table.include.list", database + ".activity_past," + database + ".teams");
        connector.put("topic.prefix", topicPrefix);
        connector.put("snapshot.mode", "no_data");
        connector.put("read.only", "true");
        connector.put("signal.enabled.channels", "kafka");
        connector.put("signal.kafka.topic", topicPrefix + ".debezium-signal");
        connector.put("signal.kafka.groupId", topicPrefix + ".debezium-signal");
        connector.put("signal.kafka.bootstrap.servers", NETWORK_KAFKA);
        connector.put("schema.history.internal.kafka.topic", topicPrefix + ".schema-history");
        connector.put("schema.history.internal.kafka.bootstrap.servers", NETWORK_KAFKA);
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

    private void createSchema() throws SQLException {
        assertThat(SAFE_DB_NAME.matcher(database).matches()).isTrue();
        execute("CREATE DATABASE " + database);
        execute("CREATE TABLE " + database + ".activity_past (id INT PRIMARY KEY, created_at TIMESTAMP(6) NOT NULL)");
        execute("CREATE TABLE " + database + ".teams (id INT PRIMARY KEY, name VARCHAR(64) NOT NULL)");
    }

    private void execute(String sql) throws SQLException {
        try (Connection connection = DriverManager.getConnection(HOST_JDBC);
             Statement statement = connection.createStatement()) {
            statement.execute(sql);
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
                ConsumerConfig.METADATA_MAX_AGE_CONFIG, 1000,
                ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class,
                ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        try (KafkaConsumer<String, String> consumer = new KafkaConsumer<>(consumerConfig)) {
            consumer.subscribe(Pattern.compile(Pattern.quote(topicPrefix + "." + database) + "\\..*"));
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
