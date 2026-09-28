package com.openframe.data.cassandra.config;

import org.springframework.test.util.ReflectionTestUtils;
import org.testcontainers.cassandra.CassandraContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * Starts a shared {@code cassandra:4.1} container on first use. To run against an already running Cassandra
 * instead (e.g. {@code docker run -d --name openframe-test-cassandra -p 9042:9042 cassandra:4.1}), pass
 * {@code -Dcassandra.external.host=localhost} and optionally {@code -Dcassandra.external.port=9042}.
 */
public abstract class BaseCassandraIntegrationTest {

    private static final String EXTERNAL_HOST = System.getProperty("cassandra.external.host");
    private static final int EXTERNAL_PORT = Integer.getInteger("cassandra.external.port", 9042);
    private static final String DATACENTER = "datacenter1";

    protected static final CassandraContainer CASSANDRA =
            new CassandraContainer(DockerImageName.parse("cassandra:4.1"));

    protected static CassandraConfig newConfig(String keyspace, int commandResultTtlSeconds) {
        CassandraConfig config = new CassandraConfig();
        ReflectionTestUtils.setField(config, "contactPoints", host());
        ReflectionTestUtils.setField(config, "port", port());
        ReflectionTestUtils.setField(config, "localDatacenter", DATACENTER);
        ReflectionTestUtils.setField(config, "keyspaceName", keyspace);
        ReflectionTestUtils.setField(config, "replicationFactor", 1);
        ReflectionTestUtils.setField(config, "commandResultTtlSeconds", commandResultTtlSeconds);
        return config;
    }

    private static String host() {
        if (EXTERNAL_HOST != null) {
            return EXTERNAL_HOST;
        }
        startContainer();
        return CASSANDRA.getHost();
    }

    private static int port() {
        if (EXTERNAL_HOST != null) {
            return EXTERNAL_PORT;
        }
        startContainer();
        return CASSANDRA.getMappedPort(9042);
    }

    private static synchronized void startContainer() {
        if (!CASSANDRA.isRunning()) {
            CASSANDRA.start();
        }
    }
}
