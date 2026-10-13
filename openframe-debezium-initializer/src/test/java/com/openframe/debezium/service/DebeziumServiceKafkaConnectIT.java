package com.openframe.debezium.service;

import com.openframe.debezium.dto.ConnectorOffsets;
import com.openframe.debezium.dto.ConnectorStatus;
import com.openframe.debezium.naming.VersionedConnectorNameStrategy;
import com.openframe.debezium.recovery.gap.GapRecoveryProperties;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

// Needs Debezium Connect 3.3.2 on localhost:8083 that can reach a Mongo replica set: quay.io/debezium/connect:3.3.2, apache/kafka:3.9.0 and mongo:7 --replSet rs0 in one docker network.
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class DebeziumServiceKafkaConnectIT {

    private static final String CONNECT_URL = System.getProperty("test.kafka-connect.url", "http://localhost:8083");
    private static final Map<String, Object> MONGO_CONFIG = Map.of(
            "connector.class", "io.debezium.connector.mongodb.MongoDbConnector",
            "mongodb.connection.string", System.getProperty("test.kafka-connect.mongo", "mongodb://openframe-test-connect-mongo:27017/?replicaSet=rs0"),
            "topic.prefix", "it.meshcentral",
            "collection.include.list", "meshcentral.events",
            "snapshot.mode", "no_data");
    private static final Map<String, Object> PARTITION = Map.of("server_id", "it.meshcentral");
    private static final Map<String, Object> OFFSET = Map.of("sec", 1791885584, "ord", 16, "resume_token", "8268ECBA10000000102B");

    private DebeziumService service;
    // Kafka Connect keeps a deleted connector's offsets, so every test needs a name of its own.
    private String name;

    @BeforeEach
    void setUp() {
        name = "it-gap-recovery-" + UUID.randomUUID() + "_v2";
        service = new DebeziumService(new VersionedConnectorNameStrategy(), null, new GapRecoveryProperties());
        ReflectionTestUtils.setField(service, "debeziumUrl", CONNECT_URL);
        ReflectionTestUtils.setField(service, "connectTimeout", Duration.ofSeconds(5));
        ReflectionTestUtils.setField(service, "readTimeout", Duration.ofSeconds(30));
        service.init();
    }

    @AfterEach
    void tearDown() {
        service.deleteConnector(name);
    }

    @Test
    void stoppedConnector_offsetsPatched_sameOffsetsReadBack() {
        // setup
        ConnectorOffsets handedOver = new ConnectorOffsets(List.of(Map.of("partition", PARTITION, "offset", OFFSET)));
        service.createStoppedConnector(name, MONGO_CONFIG);

        // execution
        service.alterConnectorOffsets(name, handedOver);

        // verifications
        ConnectorOffsets readBack = service.getConnectorOffsets(name);
        assertThat(readBack.sourceOffsets()).containsExactly(OFFSET);
    }

    @Test
    void stoppedConnector_justCreated_reportedAsStoppedWithNoOffsets() {
        // setup
        service.createStoppedConnector(name, MONGO_CONFIG);

        // execution
        ConnectorOffsets offsets = service.getConnectorOffsets(name);

        // verifications
        assertThat(offsets.isEmpty()).isTrue();
        assertThat(awaitConnectorState()).isEqualTo("STOPPED");
    }

    // The worker writes the status record asynchronously, so a fresh connector answers 404 for a moment.
    private String awaitConnectorState() {
        Instant deadline = Instant.now().plus(Duration.ofSeconds(30));
        while (Instant.now().isBefore(deadline)) {
            ConnectorStatus status = service.getConnectorStatus(name);
            if (status != null) return status.getConnector().getState();
            sleep();
        }
        throw new IllegalStateException("No status for " + name);
    }

    private static void sleep() {
        try {
            Thread.sleep(500);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
