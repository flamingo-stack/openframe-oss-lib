package com.openframe.data.cassandra.config;

import com.datastax.oss.driver.api.core.CqlIdentifier;
import com.datastax.oss.driver.api.core.CqlSession;
import com.openframe.data.cassandra.model.CassandraLogEvent;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.cassandra.config.CqlSessionFactoryBean;
import org.springframework.data.cassandra.core.convert.MappingCassandraConverter;
import org.springframework.data.cassandra.core.mapping.CassandraMappingContext;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class CassandraSchemaInitializerIntegrationTest extends BaseCassandraIntegrationTest {

    private static final String KEYSPACE = "of_schema_initializer_test";

    private CqlSessionFactoryBean sessionFactory;
    private CqlSession session;
    private CassandraSchemaInitializer initializer;

    @BeforeEach
    void setUp() {
        CassandraConfig config = newConfig(KEYSPACE, 60);
        sessionFactory = config.cassandraSession();
        sessionFactory.afterPropertiesSet();
        session = sessionFactory.getObject();

        CassandraMappingContext mappingContext = new CassandraMappingContext();
        mappingContext.setInitialEntitySet(Set.of(CassandraLogEvent.class));
        mappingContext.afterPropertiesSet();
        MappingCassandraConverter converter = new MappingCassandraConverter(mappingContext);
        converter.afterPropertiesSet();
        initializer = new CassandraSchemaInitializer(session, converter);
    }

    @AfterEach
    void tearDown() {
        if (sessionFactory != null) {
            sessionFactory.destroy();
        }
    }

    @Test
    void start_createsTheEntityTablesAndCommandResults() {
        session.execute("DROP TABLE IF EXISTS " + KEYSPACE + ".unified_logs");

        initializer.start();

        session.refreshSchema();
        var keyspace = session.getMetadata().getKeyspace(KEYSPACE).orElseThrow();
        assertThat(keyspace.getTable(CqlIdentifier.fromCql("unified_logs"))).isPresent();
        assertThat(keyspace.getTable(CqlIdentifier.fromCql("command_results"))).isPresent();
        assertThat(initializer.isRunning()).isTrue();
    }

    @Test
    void start_runTwice_tablesAlreadyThere_succeeds() {
        initializer.start();
        initializer.start();

        assertThat(initializer.isRunning()).isTrue();
    }
}
