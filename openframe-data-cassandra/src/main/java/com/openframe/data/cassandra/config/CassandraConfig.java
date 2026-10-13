package com.openframe.data.cassandra.config;

import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.config.DefaultDriverOption;
import com.datastax.oss.driver.api.core.config.DriverConfigLoader;
import com.datastax.oss.driver.api.core.type.codec.registry.CodecRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.cassandra.config.AbstractCassandraConfiguration;
import org.springframework.data.cassandra.config.CqlSessionFactoryBean;
import org.springframework.data.cassandra.config.SchemaAction;
import org.springframework.data.cassandra.core.convert.CassandraConverter;
import org.springframework.data.cassandra.core.convert.CassandraCustomConversions;
import org.springframework.data.cassandra.core.convert.MappingCassandraConverter;
import org.springframework.data.cassandra.core.convert.SchemaFactory;
import org.springframework.data.cassandra.core.mapping.CassandraMappingContext;
import org.springframework.data.cassandra.repository.config.EnableCassandraRepositories;

import java.util.Collections;

@Configuration
@ConditionalOnProperty(name = "spring.data.cassandra.enabled", havingValue = "true")
@EnableCassandraRepositories(basePackages = "com.openframe.data.cassandra.repository")
public class CassandraConfig extends AbstractCassandraConfiguration {

    private static final Logger logger = LoggerFactory.getLogger(CassandraConfig.class);

    @Value("${spring.data.cassandra.local-datacenter}")
    private String localDatacenter;

    @Value("${spring.data.cassandra.keyspace-name}")
    private String keyspaceName;

    @Value("${spring.data.cassandra.contact-points}")
    private String contactPoints;

    @Value("${spring.data.cassandra.port:9042}")
    private int port;

    @Value("${spring.data.cassandra.replication-factor:1}")
    private int replicationFactor;

    @Value("${openframe.command-result.cassandra.ttl-seconds:3600}")
    private int commandResultTtlSeconds;

    @Override
    protected String getKeyspaceName() {
        return keyspaceName;
    }

    @Override
    protected String getLocalDataCenter() {
        return localDatacenter;
    }

    @Override
    protected int getPort() {
        return port;
    }

    @Override
    protected String getContactPoints() {
        return contactPoints;
    }

    /**
     * Nothing to run while the session factory is created: the context must come up without Cassandra (the AOT
     * cache training run). {@link CassandraSchemaInitializer} runs {@link SchemaAction#CREATE_IF_NOT_EXISTS} at start.
     */
    @Override
    public SchemaAction getSchemaAction() {
        return SchemaAction.NONE;
    }

    @Override
    public CqlSessionFactoryBean cassandraSession() {
        // Create keyspace (and TTL-bearing tables that Spring Data can't express via annotations) before connecting / before SchemaAction runs.
        CqlSessionFactoryBean bean = new LazyCqlSessionFactoryBean(this::ensureKeyspaceExists,
                session -> new CassandraSessionLogger(session).logSessionDetails());
        bean.setContactPoints(contactPoints);
        bean.setPort(port);
        bean.setKeyspaceName(keyspaceName);
        bean.setLocalDatacenter(localDatacenter);
        bean.setSessionBuilderConfigurer(builder -> {
            logger.debug("Configuring Cassandra session builder with load balancing DC: {}", localDatacenter);
            return builder.withConfigLoader(driverConfig());
        });
        return bean;
    }

    private DriverConfigLoader driverConfig() {
        return DriverConfigLoader.programmaticBuilder()
                .withString(DefaultDriverOption.LOAD_BALANCING_LOCAL_DATACENTER, localDatacenter)
                .withStringList(DefaultDriverOption.CONTACT_POINTS, Collections.singletonList(contactPoints + ":" + port))
                .withString(DefaultDriverOption.TIMESTAMP_GENERATOR_CLASS,
                        "com.datastax.oss.driver.internal.core.time.ServerSideTimestampGenerator")
                // A session opened by a failed startup is never closed; its threads must not keep the JVM alive.
                .withBoolean(DefaultDriverOption.NETTY_DAEMON, true)
                .build();
    }

    /**
     * Creates the keyspace if it doesn't exist.
     * This runs before CqlSessionFactoryBean connects to the keyspace.
     */
    private void ensureKeyspaceExists() {
        logger.info("Initializing Cassandra session with contact points: {}, port: {}, datacenter: {}, keyspace: {}",
                contactPoints, port, localDatacenter, keyspaceName);
        logger.info("Ensuring keyspace '{}' exists with replication factor {}", keyspaceName, replicationFactor);

        try (CqlSession session = CqlSession.builder()
                .withConfigLoader(driverConfig())
                .build()) {

            String createKeyspaceCql = String.format(
                    "CREATE KEYSPACE IF NOT EXISTS %s WITH replication = {'class': 'SimpleStrategy', 'replication_factor': %d}",
                    keyspaceName, replicationFactor);

            session.execute(createKeyspaceCql);
            logger.info("Keyspace '{}' is ready", keyspaceName);

            String createCommandResultsTable = String.format(
                    "CREATE TABLE IF NOT EXISTS %s.command_results (" +
                            "execution_id text, machine_id text, result text, " +
                            "PRIMARY KEY (execution_id, machine_id)) " +
                            "WITH default_time_to_live = %d",
                    keyspaceName, commandResultTtlSeconds);
            session.execute(createCommandResultsTable);
            logger.info("Table '{}.command_results' is ready (default_time_to_live={}s)",
                    keyspaceName, commandResultTtlSeconds);

        } catch (Exception e) {
            logger.error("Failed to create keyspace '{}'", keyspaceName, e);
            throw new RuntimeException("Failed to ensure Cassandra keyspace exists", e);
        }
    }

    /**
     * Same converter as the parent's, without asking the session for its codec registry: that would connect while the
     * bean is created. The driver config registers no codecs, so the session's registry is the default one.
     */
    @Override
    @Bean
    public CassandraConverter cassandraConverter() {
        MappingCassandraConverter converter = new MappingCassandraConverter(requireBeanOfType(CassandraMappingContext.class));
        converter.setCodecRegistry(CodecRegistry.DEFAULT);
        converter.setUserTypeResolver(userTypeResolver(getRequiredSession()));
        converter.setCustomConversions(requireBeanOfType(CassandraCustomConversions.class));
        return converter;
    }

    @Bean
    public CassandraSchemaInitializer cassandraSchemaInitializer(CqlSession session, CassandraConverter converter) {
        return new CassandraSchemaInitializer(session, converter, SchemaAction.CREATE_IF_NOT_EXISTS);
    }

    @Bean
    public CassandraTableColumnSync cassandraTableColumnSync(CqlSession session,
                                                             CassandraMappingContext mappingContext,
                                                             CassandraConverter converter) {
        SchemaFactory schemaFactory = new SchemaFactory(converter);
        return new CassandraTableColumnSync(session, mappingContext, schemaFactory, keyspaceName);
    }
}
