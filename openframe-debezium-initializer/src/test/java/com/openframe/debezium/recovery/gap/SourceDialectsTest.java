package com.openframe.debezium.recovery.gap;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

class SourceDialectsTest {

    private static final Map<String, Object> MONGO_CONFIG =
            Map.of("connector.class", "io.debezium.connector.mongodb.MongoDbConnector");
    private static final Map<String, Object> POSTGRES_CONFIG =
            Map.of("connector.class", "io.debezium.connector.postgresql.PostgresConnector");

    private final SourceDialects dialects = new SourceDialects(List.of(new MongoSourceDialect(), new MySqlSourceDialect()));

    @ParameterizedTest
    @ValueSource(strings = {
            "com.mongodb.MongoCommandException: Command failed with error 286 (ChangeStreamHistoryLost)",
            "io.debezium.DebeziumException: The connector is trying to read binlog starting at GTIDs ..., but this is no longer available on the server."
    })
    void isHistoryLost_traceWithKnownMarker_true(String trace) {
        // setup
        List<String> traces = List.of("org.apache.kafka.connect.errors.ConnectException: wrapped", trace);

        // execution
        boolean historyLost = dialects.isHistoryLost(traces);

        // verifications
        assertThat(historyLost).isTrue();
    }

    @Test
    void isHistoryLost_unrelatedTrace_false() {
        // setup
        List<String> traces = List.of("org.apache.kafka.common.errors.TimeoutException: Timed out");

        // execution
        boolean historyLost = dialects.isHistoryLost(traces);

        // verifications
        assertThat(historyLost).isFalse();
    }

    @Test
    void supports_mongoConnector_true() {
        // execution
        boolean supported = dialects.supports(MONGO_CONFIG);

        // verifications
        assertThat(supported).isTrue();
    }

    @Test
    void dialectFor_mysqlConnector_mysqlDialect() {
        // setup
        Map<String, Object> config = Map.of("connector.class", "io.debezium.connector.mysql.MySqlConnector");

        // execution
        SourceDialect dialect = dialects.dialectFor(config);

        // verifications
        assertThat(dialect).isInstanceOf(MySqlSourceDialect.class);
    }

    @Test
    void supports_postgresConnector_false() {
        // execution
        boolean supported = dialects.supports(POSTGRES_CONFIG);

        // verifications
        assertThat(supported).isFalse();
    }

    @Test
    void dialectFor_mongoConnector_mongoDialect() {
        // execution
        SourceDialect dialect = dialects.dialectFor(MONGO_CONFIG);

        // verifications
        assertThat(dialect).isInstanceOf(MongoSourceDialect.class);
    }

    @Test
    void dialectFor_unknownConnector_throwsIllegalArgument() {
        // execution
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> dialects.dialectFor(POSTGRES_CONFIG));

        // verifications
        assertThat(ex.getMessage()).contains("io.debezium.connector.postgresql.PostgresConnector");
    }
}
