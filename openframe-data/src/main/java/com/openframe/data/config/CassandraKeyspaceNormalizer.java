package com.openframe.data.config;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

import java.util.Map;

/**
 * Normalizes Cassandra keyspace name by replacing dashes with underscores.
 * Cassandra keyspace names can only contain alphanumeric characters and underscores.
 * This allows using TENANT_ID with dashes in configuration while ensuring
 * the actual keyspace name is valid for Cassandra.
 */
public class CassandraKeyspaceNormalizer implements EnvironmentPostProcessor {

    private static final String KEYSPACE_PROPERTY = "spring.data.cassandra.keyspace-name";
    private static final String PROPERTY_SOURCE_NAME = "cassandra-keyspace-normalizer";

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        String keyspace = environment.getProperty(KEYSPACE_PROPERTY);

        if (keyspace == null || keyspace.isEmpty()) {
            return;
        }

        if (!keyspace.contains("-")) {
            return;
        }

        String normalized = keyspace.replace("-", "_");
        Map<String, Object> props = Map.of(KEYSPACE_PROPERTY, normalized);
        environment.getPropertySources().addFirst(new MapPropertySource(PROPERTY_SOURCE_NAME, props));
    }
}
