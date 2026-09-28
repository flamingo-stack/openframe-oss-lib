package com.openframe.data.cassandra.config;

import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.config.DefaultDriverOption;
import com.datastax.oss.driver.api.core.config.DriverExecutionProfile;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.cassandra.config.CqlSessionFactoryBean;

import static org.assertj.core.api.Assertions.assertThat;

class CassandraConfigSessionTest extends BaseCassandraIntegrationTest {

    private static final String KEYSPACE = "of_config_session_test";
    private static final int TTL_SECONDS = 1800;

    private CqlSessionFactoryBean sessionFactory;

    @BeforeEach
    void setUp() throws Exception {
        CassandraConfig config = newConfig(KEYSPACE, TTL_SECONDS);

        sessionFactory = config.cassandraSession();
        sessionFactory.afterPropertiesSet();
    }

    @AfterEach
    void tearDown() {
        if (sessionFactory != null) {
            sessionFactory.destroy();
        }
    }

    @Test
    void ensureKeyspaceExistsCreatesKeyspaceAndCommandResultsTableWithTtl() {
        CqlSession session = sessionFactory.getObject();

        assertThat(session.getKeyspace()).hasValueSatisfying(keyspace -> assertThat(keyspace.asInternal()).isEqualTo(KEYSPACE));
        int ttl = session.execute(
                "SELECT default_time_to_live FROM system_schema.tables WHERE keyspace_name = ? AND table_name = 'command_results'",
                KEYSPACE).one().getInt("default_time_to_live");
        assertThat(ttl).isEqualTo(TTL_SECONDS);
    }

    @Test
    void sessionUsesServerSideTimestampsAndConfiguredDatacenter() {
        DriverExecutionProfile profile = sessionFactory.getObject().getContext().getConfig().getDefaultProfile();

        assertThat(profile.getString(DefaultDriverOption.TIMESTAMP_GENERATOR_CLASS)).endsWith("ServerSideTimestampGenerator");
        assertThat(profile.getString(DefaultDriverOption.LOAD_BALANCING_LOCAL_DATACENTER)).isEqualTo("datacenter1");
    }
}
