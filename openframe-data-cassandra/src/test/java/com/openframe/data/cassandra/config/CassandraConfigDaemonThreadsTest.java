package com.openframe.data.cassandra.config;

import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.config.DefaultDriverOption;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.cassandra.config.CqlSessionFactoryBean;

import java.util.List;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

class CassandraConfigDaemonThreadsTest extends BaseCassandraIntegrationTest {

    private static final String KEYSPACE = "of_config_daemon_threads_test";
    private static final Pattern DRIVER_THREAD = Pattern.compile("s\\d+-(io|admin|timer)-\\d+");

    private CqlSessionFactoryBean sessionFactory;

    @BeforeEach
    void setUp() throws Exception {
        CassandraConfig config = newConfig(KEYSPACE, 3600);

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
    void reproducesBug_CU_cassandra_boot_hang_driverThreadsDoNotKeepJvmAlive() {
        CqlSession session = sessionFactory.getObject();

        assertThat(session.getContext().getConfig().getDefaultProfile()
                .getBoolean(DefaultDriverOption.NETTY_DAEMON)).isTrue();

        List<Thread> driverThreads = Thread.getAllStackTraces().keySet().stream()
                .filter(thread -> DRIVER_THREAD.matcher(thread.getName()).matches())
                .toList();
        assertThat(driverThreads).isNotEmpty().allMatch(Thread::isDaemon);
    }
}
