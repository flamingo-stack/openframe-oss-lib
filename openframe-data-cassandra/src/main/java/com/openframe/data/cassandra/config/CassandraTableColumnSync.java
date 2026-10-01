package com.openframe.data.cassandra.config;

import com.datastax.oss.driver.api.core.CqlIdentifier;
import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.cql.SimpleStatement;
import com.datastax.oss.driver.api.core.metadata.Metadata;
import com.datastax.oss.driver.api.core.metadata.schema.ColumnMetadata;
import com.datastax.oss.driver.api.core.metadata.schema.KeyspaceMetadata;
import com.datastax.oss.driver.api.core.metadata.schema.TableMetadata;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.SmartInitializingSingleton;
import org.springframework.data.cassandra.core.convert.SchemaFactory;
import org.springframework.data.cassandra.core.cql.keyspace.ColumnSpecification;
import org.springframework.data.cassandra.core.cql.keyspace.CreateTableSpecification;
import org.springframework.data.cassandra.core.mapping.CassandraMappingContext;
import org.springframework.data.cassandra.core.mapping.CassandraPersistentEntity;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;

// Spring Data's CREATE_IF_NOT_EXISTS never alters a table that already exists, so a column added to an
// entity later has to be added here; it runs after the schema action, once every singleton is up.
@Slf4j
@RequiredArgsConstructor
public class CassandraTableColumnSync implements SmartInitializingSingleton {

    // A schema change waits for cluster-wide agreement, which takes longer than the default request timeout.
    private static final Duration SCHEMA_CHANGE_TIMEOUT = Duration.ofSeconds(30);

    private final CqlSession session;
    private final CassandraMappingContext mappingContext;
    private final SchemaFactory schemaFactory;
    private final String keyspaceName;

    @Override
    public void afterSingletonsInstantiated() {
        try {
            syncKeyspace();
        } catch (RuntimeException e) {
            // A missing column fails only the writes that use it; failing startup would take the whole service down.
            log.error("Cassandra column sync failed for keyspace {}", keyspaceName, e);
        }
    }

    private void syncKeyspace() {
        Metadata metadata = session.getMetadata();
        Optional<KeyspaceMetadata> keyspace = metadata.getKeyspace(keyspaceName);
        keyspace.ifPresentOrElse(this::syncTables, this::warnKeyspaceMissing);
    }

    private void syncTables(KeyspaceMetadata keyspace) {
        mappingContext.getTableEntities().forEach(entity -> syncTable(entity, keyspace));
    }

    private void warnKeyspaceMissing() {
        log.warn("Cassandra keyspace {} is not in the driver metadata, skipping the column sync", keyspaceName);
    }

    private void syncTable(CassandraPersistentEntity<?> entity, KeyspaceMetadata keyspace) {
        CqlIdentifier tableName = entity.getTableName();
        keyspace.getTable(tableName).ifPresent(table -> addMissingColumns(entity, table));
    }

    private void addMissingColumns(CassandraPersistentEntity<?> entity, TableMetadata table) {
        CreateTableSpecification specification = schemaFactory.getCreateTableSpecificationFor(entity);
        List<ColumnSpecification> missing = specification.getNonKeyColumns().stream()
                .filter(column -> isMissing(column, table))
                .toList();
        CqlIdentifier tableName = entity.getTableName();
        missing.forEach(column -> addColumn(tableName, column));
    }

    private static boolean isMissing(ColumnSpecification column, TableMetadata table) {
        CqlIdentifier name = column.getName();
        Map<CqlIdentifier, ColumnMetadata> existing = table.getColumns();
        return !existing.containsKey(name);
    }

    private void addColumn(CqlIdentifier table, ColumnSpecification column) {
        String tableName = table.asCql(true);
        String columnName = column.getName().asCql(true);
        String columnType = column.getType().asCql(true, true);
        String cql = String.format("ALTER TABLE %s.%s ADD IF NOT EXISTS %s %s", keyspaceName, tableName, columnName, columnType);
        SimpleStatement statement = SimpleStatement.newInstance(cql).setTimeout(SCHEMA_CHANGE_TIMEOUT);
        session.execute(statement);
        log.info("Added missing column {} {} to Cassandra table {}.{}", columnName, columnType, keyspaceName, tableName);
    }
}
