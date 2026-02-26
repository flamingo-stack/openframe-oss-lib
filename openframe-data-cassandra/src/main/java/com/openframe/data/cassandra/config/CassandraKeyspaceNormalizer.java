package com.openframe.data.cassandra.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

import java.util.Map;

/**
 * Normalizes Cassandra keyspace name by replacing dashes with underscores.
 * Cassandra keyspace names can only contain alphanumeric characters and underscores.
 * This allows using TENANT_ID with dashes in configuration while ensuring
 * the actual keyspace name is valid for Cassandra.
 * <p>
 * Uses ApplicationContextInitializer instead of EnvironmentPostProcessor to ensure
 * it runs after Spring Cloud Config properties are loaded.
 */
public class CassandraKeyspaceNormalizer implements ApplicationContextInitializer<ConfigurableApplicationContext> {

    private static final Logger log = LoggerFactory.getLogger(CassandraKeyspaceNormalizer.class);

    private static final String KEYSPACE_PROPERTY = "spring.data.cassandra.keyspace-name";
    private static final String PROPERTY_SOURCE_NAME = "cassandra-keyspace-normalizer";

    @Override
    public void initialize(ConfigurableApplicationContext applicationContext) {
        ConfigurableEnvironment environment = applicationContext.getEnvironment();
        String keyspace = environment.getProperty(KEYSPACE_PROPERTY);

        if (keyspace == null || keyspace.isEmpty()) {
            return;
        }

        if (!keyspace.contains("-")) {
            log.debug("Keyspace '{}' does not contain dashes, skipping normalization", keyspace);
            return;
        }

        String normalized = keyspace.replace("-", "_");
        log.info("Normalizing Cassandra keyspace name: '{}' -> '{}'", keyspace, normalized);

        Map<String, Object> props = Map.of(KEYSPACE_PROPERTY, normalized);
        environment.getPropertySources().addFirst(new MapPropertySource(PROPERTY_SOURCE_NAME, props));
    }
}
