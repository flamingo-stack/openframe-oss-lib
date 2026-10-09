package com.openframe.data.cassandra.config;

import com.datastax.oss.driver.api.core.CqlSession;
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
    private static final String CREATE_SYNCED_ROWS_BEFORE_THE_ADDED_COLUMNS = """
            CREATE TABLE %s.synced_rows (id text PRIMARY KEY, kept_column text)
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
        session.execute("DROP TABLE IF EXISTS " + KEYSPACE + ".synced_rows");
        session.execute(CREATE_SYNCED_ROWS_BEFORE_THE_ADDED_COLUMNS.formatted(KEYSPACE));

        CassandraMappingContext mappingContext = new CassandraMappingContext();
        mappingContext.setInitialEntitySet(Set.of(SyncedRow.class));
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
    void afterSingletonsInstantiated_tableProvisionedBeforeTheAddedColumns_addsThem() {
        // setup
        List<String> before = columnNames();

        // execution
        sync.afterSingletonsInstantiated();

        // verifications
        assertThat(before).doesNotContain("added_column", "other_added_column");
        assertThat(columnNames()).contains("added_column", "other_added_column");
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
                        "SELECT column_name FROM system_schema.columns WHERE keyspace_name = ? AND table_name = 'synced_rows'",
                        KEYSPACE)
                .all().stream()
                .map(row -> row.getString("column_name"))
                .toList();
    }
}
