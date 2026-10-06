package com.openframe.data.cassandra.config;

import com.datastax.oss.driver.api.core.CqlSession;
import com.openframe.data.cassandra.model.UnifiedLogEvent;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.cassandra.config.CqlSessionFactoryBean;
import org.springframework.data.cassandra.core.convert.MappingCassandraConverter;
import org.springframework.data.cassandra.core.convert.SchemaFactory;
import org.springframework.data.cassandra.core.mapping.CassandraMappingContext;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class CassandraTableColumnSyncIntegrationTest extends BaseCassandraIntegrationTest {

    private static final String KEYSPACE = "of_column_sync_test";
    private static final int TTL_SECONDS = 60;
    private static final String CREATE_UNIFIED_LOGS_BEFORE_RUN_ORIGIN = """
            CREATE TABLE %s.unified_logs (
                ingest_day text, tool_type text, tenant_id text, event_type text, event_timestamp timestamp,
                tool_event_id text, user_id text, device_id text, hostname text, nickname text,
                organization_id text, organization_name text, severity text, message text,
                debezium_message text, details text,
                PRIMARY KEY ((ingest_day, tool_type), tenant_id, event_type, event_timestamp, tool_event_id))
            """;

    private CqlSessionFactoryBean sessionFactory;
    private CqlSession session;
    private CassandraTableColumnSync sync;

    @BeforeEach
    void setUp() throws Exception {
        CassandraConfig config = newConfig(KEYSPACE, TTL_SECONDS);
        sessionFactory = config.cassandraSession();
        sessionFactory.afterPropertiesSet();
        session = sessionFactory.getObject();
        session.execute("DROP TABLE IF EXISTS " + KEYSPACE + ".unified_logs");
        session.execute(CREATE_UNIFIED_LOGS_BEFORE_RUN_ORIGIN.formatted(KEYSPACE));

        CassandraMappingContext mappingContext = new CassandraMappingContext();
        mappingContext.setInitialEntitySet(Set.of(UnifiedLogEvent.class));
        mappingContext.afterPropertiesSet();
        MappingCassandraConverter converter = new MappingCassandraConverter(mappingContext);
        converter.afterPropertiesSet();
        SchemaFactory schemaFactory = new SchemaFactory(converter);
        sync = new CassandraTableColumnSync(session, mappingContext, schemaFactory, KEYSPACE);
    }

    @AfterEach
    void tearDown() {
        if (sessionFactory != null) {
            sessionFactory.destroy();
        }
    }

    @Test
    void afterSingletonsInstantiated_tableProvisionedBeforeRunOriginColumns_addsThem() {
        // setup
        List<String> before = columnNames();

        // execution
        sync.afterSingletonsInstantiated();

        // verifications
        assertThat(before).doesNotContain("execution_source", "script_creation_source");
        assertThat(columnNames()).contains("execution_source", "script_creation_source");
    }

    @Test
    void afterSingletonsInstantiated_runTwice_secondRunIsNoOp() {
        // setup
        sync.afterSingletonsInstantiated();
        List<String> afterFirstRun = columnNames();

        // execution
        sync.afterSingletonsInstantiated();

        // verifications
        assertThat(columnNames()).containsExactlyInAnyOrderElementsOf(afterFirstRun);
    }

    private List<String> columnNames() {
        return session.execute(
                        "SELECT column_name FROM system_schema.columns WHERE keyspace_name = ? AND table_name = 'unified_logs'",
                        KEYSPACE)
                .all().stream()
                .map(row -> row.getString("column_name"))
                .toList();
    }
}
